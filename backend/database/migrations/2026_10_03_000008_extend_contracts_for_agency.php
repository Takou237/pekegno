<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : un contrat naît d'une prestation validée ou d'une souscription
 * à un package (D1/D3). Il passe `active` au premier paiement (D10) ; le PDF
 * signé est facultatif. Nouveaux statuts : draft, pending, renewed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->string('origin', 20)->default('manual')->after('pack_id'); // prestation | package | manual
            $table->foreignUuid('prestation_id')->nullable()->after('origin')->constrained('prestations')->nullOnDelete();
            $table->foreignUuid('commercial_id')->nullable()->after('prestation_id')->constrained('commercials')->nullOnDelete();
            $table->decimal('budget_allocated', 15, 2)->nullable()->after('amount');
            $table->timestamp('activated_at')->nullable()->after('status');
            $table->timestamp('signed_at')->nullable()->after('activated_at');
            $table->string('signed_document_path')->nullable()->after('signed_at');
            $table->text('suspended_reason')->nullable()->after('terminated_reason');
            $table->foreignUuid('legacy_subscription_id')->nullable()->after('suspended_reason')->constrained('subscriptions')->nullOnDelete();
            $table->unique('legacy_subscription_id');
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropUnique(['legacy_subscription_id']);
            $table->dropConstrainedForeignId('legacy_subscription_id');
            $table->dropConstrainedForeignId('prestation_id');
            $table->dropConstrainedForeignId('commercial_id');
            $table->dropColumn(['origin', 'budget_allocated', 'activated_at', 'signed_at', 'signed_document_path', 'suspended_reason']);
        });
    }
};
