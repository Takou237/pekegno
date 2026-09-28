<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chaque pays facture dans sa propre monnaie (currency_code). Pour afficher
 * les agrégats PEKEGNO GROUP dans une monnaie unique, on mémorise le taux
 * d'équivalence : 1 unité de la monnaie du pays = exchange_rate unités de la
 * monnaie du groupe (réglage group_currency, XAF par défaut ; 1 XOF = 1 XAF).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('countries', function (Blueprint $table) {
            $table->decimal('exchange_rate', 18, 6)->default(1)->after('currency_code');
        });
    }

    public function down(): void
    {
        Schema::table('countries', function (Blueprint $table) {
            $table->dropColumn('exchange_rate');
        });
    }
};
