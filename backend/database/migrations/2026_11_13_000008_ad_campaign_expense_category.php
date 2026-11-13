<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * T3.8 — une campagne publicitaire crée automatiquement sa dépense. Celle-ci
 * doit avoir une catégorie comptable : « Publicité Pekegno », globale (sans
 * agence), donc disponible pour l'agence ciblée comme pour l'Administration
 * d'un pays (campagne nationale).
 */
return new class extends Migration
{
    private const NAME = 'Publicité Pekegno';

    public function up(): void
    {
        $existing = DB::table('accounting_categories')
            ->where('name', self::NAME)
            ->whereNull('agency_id')
            ->first();

        if ($existing) {
            DB::table('accounting_categories')->where('id', $existing->id)->update([
                'type' => 'expense',
                'is_system' => true,
                'updated_at' => now(),
            ]);

            return;
        }

        DB::table('accounting_categories')->insert([
            'id' => (string) Str::uuid(),
            'name' => self::NAME,
            'type' => 'expense',
            'agency_id' => null,
            'is_system' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        // La catégorie peut déjà porter des dépenses : on la conserve.
    }
};
