<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * L5 (contrôles de saisie) : sans `phone_code`, ValidPhoneNumber ne peut pas
 * vérifier l'indicatif d'un numéro et accepte donc « +225… » pour un client
 * camerounais. Les pays créés hors seeder ont pu rester sans indicatif.
 */
return new class extends Migration
{
    /** Indicatifs officiels des pays supportés. */
    private const PHONE_CODES = [
        'CMR' => '+237',
        'CIV' => '+225',
    ];

    public function up(): void
    {
        foreach (self::PHONE_CODES as $code => $phoneCode) {
            DB::table('countries')
                ->where('code', $code)
                ->where(fn ($q) => $q->whereNull('phone_code')->orWhere('phone_code', ''))
                ->update(['phone_code' => $phoneCode]);
        }
    }

    public function down(): void
    {
        // Aucune donnée métier perdue : on ne remet pas les indicatifs à null.
    }
};
