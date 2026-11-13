<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T3.1 — Type 'administration' pour les entités Administration par pays.
 *
 * Permet d'avoir une entité Administration distincte des agences opérationnelles
 * pour loger les charges du siège, le stock central et les caisses propres par pays.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_type_check');
            DB::statement("ALTER TABLE agencies ADD CONSTRAINT agencies_type_check CHECK (type IN ('agency', 'academy', 'mixed', 'administration'))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_type_check');
            DB::statement("ALTER TABLE agencies ADD CONSTRAINT agencies_type_check CHECK (type IN ('agency', 'academy', 'mixed'))");
        }
    }
};
