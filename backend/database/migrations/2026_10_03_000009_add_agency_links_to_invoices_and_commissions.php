<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : rattache les factures aux contrats et les lignes aux packages /
 * prestations ; marque les lignes de budget publicitaire client (pass-through,
 * D7/D15) ; ajoute le taux de commission par package (D13).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignUuid('contract_id')->nullable()->after('client_id')->constrained('contracts')->nullOnDelete();
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignUuid('package_id')->nullable()->after('product_id')->constrained('subscription_packs')->nullOnDelete();
            $table->foreignUuid('prestation_id')->nullable()->after('package_id')->constrained('prestations')->nullOnDelete();
            $table->boolean('is_pass_through')->default(false)->after('line_total');
        });

        Schema::table('commission_rules', function (Blueprint $table) {
            $table->foreignUuid('package_id')->nullable()->after('course_id')->constrained('subscription_packs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('package_id');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('package_id');
            $table->dropConstrainedForeignId('prestation_id');
            $table->dropColumn('is_pass_through');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('contract_id');
        });
    }
};
