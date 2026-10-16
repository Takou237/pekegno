<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rattrapage géographique des agences (CA Côte d'Ivoire à 0) : les agences
 * historiques ont `country`/`city` (varchar) mais `country_id`/`city_id` NULL,
 * si bien que tous les filtres pays (whereIn sur country_id) rendaient 0.
 * Cette migration recopie les FK depuis les libellés, sans écraser les FK
 * déjà renseignées.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Pays : correspondance exacte puis insensible à la casse/accents via LOWER.
        $agencies = DB::table('agencies')->whereNull('country_id')->whereNotNull('country')->get(['id', 'country']);
        foreach ($agencies as $agency) {
            $countryId = DB::table('countries')
                ->where('name', $agency->country)
                ->orWhereRaw('LOWER(name) = LOWER(?)', [$agency->country])
                ->value('id');
            if ($countryId) {
                DB::table('agencies')->where('id', $agency->id)->update(['country_id' => $countryId]);
            }
        }

        $agencies = DB::table('agencies')->whereNull('city_id')->whereNotNull('city')->get(['id', 'city', 'country_id']);
        foreach ($agencies as $agency) {
            $cityId = DB::table('cities')
                ->where('name', $agency->city)
                ->when($agency->country_id, fn ($q) => $q->where('country_id', $agency->country_id))
                ->value('id')
                ?? DB::table('cities')->whereRaw('LOWER(name) = LOWER(?)', [$agency->city])->value('id');
            if ($cityId) {
                DB::table('agencies')->where('id', $agency->id)->update(['city_id' => $cityId]);
            }
        }
    }

    public function down(): void
    {
        // Backfill non réversible (on ne supprime pas les FK restaurées).
    }
};
