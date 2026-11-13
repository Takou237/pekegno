<?php

use App\Models\Agency;
use App\Services\TreasuryAccountProvisioner;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Caisses : l'« administration » = super-admin, direction générale, chef
 * d'agence, chef de département (+ comptable). Les caisses numériques et
 * bancaires leur sont visibles ; chaque agence reçoit ses caisses standard
 * (C/O/M/B, + W en zone XOF) si elles manquent.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('treasury_accounts')
            ->whereNotNull('visible_roles')
            ->update(['visible_roles' => json_encode(TreasuryAccountProvisioner::RESTRICTED_ROLES)]);

        $provisioner = app(TreasuryAccountProvisioner::class);
        Agency::query()->with('geoCountry')->get()->each(fn (Agency $agency) => $provisioner->ensureForAgency($agency));
    }

    public function down(): void
    {
        // Les caisses créées restent (elles peuvent déjà porter des mouvements).
    }
};
