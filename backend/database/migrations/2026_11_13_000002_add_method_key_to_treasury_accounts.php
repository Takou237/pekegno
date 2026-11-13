<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Une caisse = un moyen de paiement. `method_key` est la valeur enregistrée
 * sur les factures et paiements (cash, om, momo, wave, moov, bank, ou la clé
 * d'une caisse créée par l'administration). « Caisse Principale » devient
 * « Caisse Espèces ».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treasury_accounts', function (Blueprint $table) {
            $table->string('method_key', 40)->nullable()->after('code');
            $table->index('method_key');
        });

        foreach (['C' => 'cash', 'O' => 'om', 'M' => 'momo', 'W' => 'wave', 'V' => 'moov', 'B' => 'bank'] as $code => $key) {
            DB::table('treasury_accounts')->where('code', $code)->whereNull('method_key')->update(['method_key' => $key]);
        }

        DB::table('treasury_accounts')->where('name', 'Caisse Principale')->update(['name' => 'Caisse Espèces']);
    }

    public function down(): void
    {
        DB::table('treasury_accounts')->where('name', 'Caisse Espèces')->update(['name' => 'Caisse Principale']);

        Schema::table('treasury_accounts', function (Blueprint $table) {
            $table->dropIndex(['method_key']);
            $table->dropColumn('method_key');
        });
    }
};
