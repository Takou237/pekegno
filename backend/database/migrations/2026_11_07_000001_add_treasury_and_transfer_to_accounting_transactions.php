<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T1.4 / T2.7 / B13.
 *  - treasury_account_id : caisse d'où sort une dépense saisie en Comptabilité
 *    (obligatoire côté API pour les dépenses) ;
 *  - is_transfer : écriture qui est un transfert entre caisses (versement en
 *    banque, décaissement administratif…) et non une charge. Exclue des dépenses
 *    partout, sans toucher à l'enum `type` (income|expense).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->foreignUuid('treasury_account_id')->nullable()->after('category_id')
                ->constrained('treasury_accounts')->nullOnDelete();
            $table->boolean('is_transfer')->default(false)->after('type');
            $table->index(['type', 'is_transfer']);
        });
    }

    public function down(): void
    {
        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->dropIndex(['type', 'is_transfer']);
            $table->dropConstrainedForeignId('treasury_account_id');
            $table->dropColumn('is_transfer');
        });
    }
};
