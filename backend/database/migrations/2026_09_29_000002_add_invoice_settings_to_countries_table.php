<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * En-tête / pied de facture propres à l'entité de chaque pays (PEKEGNO
 * Cameroun SARL, PEKEGNO Côte d'Ivoire...) : raison sociale, adresse,
 * contacts, NUI, comptes de paiement et cachet de la direction.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('countries', function (Blueprint $table) {
            $table->json('invoice_settings')->nullable()->after('exchange_rate');
        });
    }

    public function down(): void
    {
        Schema::table('countries', function (Blueprint $table) {
            $table->dropColumn('invoice_settings');
        });
    }
};
