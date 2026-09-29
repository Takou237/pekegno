<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Un ancien seeder écrivait `presentiel`, hors nomenclature (online | in_person
 * | mixed) : ces formations échappaient aux filtres par type et aux statistiques.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('courses')->whereIn('mode', ['presentiel', 'présentiel'])->update(['mode' => 'in_person']);
        DB::table('courses')->whereIn('mode', ['en_ligne', 'enligne', 'en ligne'])->update(['mode' => 'online']);
    }

    public function down(): void
    {
        // Données normalisées : rien à restaurer.
    }
};
