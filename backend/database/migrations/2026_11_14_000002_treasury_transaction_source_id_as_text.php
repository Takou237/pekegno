<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * treasury_transactions.source_id porte un uuid (paiement, dépense…) OU une
 * référence de transfert (« XFER-… », « RECLASS-… »). En uuid, PostgreSQL
 * refusait tout transfert entre caisses (erreur 500) ; SQLite l'acceptait.
 * Instruction compatible PostgreSQL 9.6 (o2switch).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE treasury_transactions ALTER COLUMN source_id TYPE varchar(64) USING source_id::text');
        }
    }

    public function down(): void
    {
        // Pas de retour en uuid : les références de transfert ne le supportent pas.
    }
};
