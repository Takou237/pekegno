<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * « Soumettre une prestation avec preuve » (P1) : le commercial/caissier déclare
 * le montant encaissé et joint une preuve photo. Ces champs conservent la
 * déclaration ; l'encaissement réel reste géré par le workflow PaymentProof
 * (facture en attente de validation → le caissier accepte la preuve).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prestations', function (Blueprint $table) {
            $table->decimal('declared_advance_amount', 15, 2)->nullable()->after('commission_value');
            $table->boolean('declared_total_paid')->default(false)->after('declared_advance_amount');
            $table->foreignUuid('payment_proof_id')->nullable()->after('contract_id')
                ->constrained('payment_proofs')->nullOnDelete();
            $table->timestamp('submitted_with_proof_at')->nullable()->after('validated_at');
        });
    }

    public function down(): void
    {
        Schema::table('prestations', function (Blueprint $table) {
            $table->dropForeign(['payment_proof_id']);
        });

        Schema::table('prestations', function (Blueprint $table) {
            $table->dropColumn([
                'declared_advance_amount',
                'declared_total_paid',
                'payment_proof_id',
                'submitted_with_proof_at',
            ]);
        });
    }
};