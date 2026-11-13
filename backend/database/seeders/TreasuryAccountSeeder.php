<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Services\TreasuryAccountProvisioner;
use Illuminate\Database\Seeder;

/**
 * T2.2 — une caisse C/O/M/B par agence, plus W (Wave) en Côte d'Ivoire
 * (décision client T0.3 ; Moov n'est pas déployé).
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
