<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Services\TreasuryAccountProvisioner;
use Illuminate\Database\Seeder;

/**
 * T2.2 — une caisse C/O/M/B par agence (plus W/V en Côte d'Ivoire).
 *
 * Les modèles de caisses sont définis dans TreasuryAccountProvisioner (source
 * unique, partagée avec la résolution de caisse des paiements). Idempotent :
 * une caisse existante n'est pas modifiée.
 */
class TreasuryAccountSeeder extends Seeder
{
    public function run(TreasuryAccountProvisioner $provisioner): void
    {
        foreach (Agency::all() as $agency) {
            $provisioner->ensureForAgency($agency);
        }
    }
}
