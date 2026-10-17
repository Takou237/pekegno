<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Montant porté par une preuve de paiement. Nul pour les preuves jointes à
     * la création d'une facture (l'avance déclarée porte déjà le montant) ;
     * renseigné pour les règlements du reste à payer après validation, afin que
     * le caissier sache quel montant encaisser en acceptant la preuve.
     */
    public function up(): void
    {
        Schema::table('payment_proofs', function (Blueprint $table) {
            $table->decimal('amount', 12, 2)->nullable()->after('reference');
        });
    }

    public function down(): void
    {
        Schema::table('payment_proofs', function (Blueprint $table) {
            $table->dropColumn('amount');
        });
    }
};
