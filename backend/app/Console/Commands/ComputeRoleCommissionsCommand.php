<?php

namespace App\Console\Commands;

use App\Services\RoleCommissionService;
use Illuminate\Console\Command;

/**
 * Primes périodiques des règles par rôle (CA mensuel par paliers, croissance
 * vs N-1). Par défaut : le mois écoulé. Relançable sans doublon.
 */
class ComputeRoleCommissionsCommand extends Command
{
    protected $signature = 'commissions:compute-period {period? : Mois au format YYYY-MM (défaut : mois précédent)}';

    protected $description = 'Calcule les primes mensuelles des règles de commission attribuées aux rôles';

    public function handle(RoleCommissionService $service): int
    {
        $period = $this->argument('period') ?? now()->subMonthNoOverflow()->format('Y-m');

        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            $this->error('Période invalide (attendu : YYYY-MM).');

            return self::FAILURE;
        }

        $result = $service->computePeriod($period);

        $this->info("Période {$period} : {$result['created']} prime(s) créée(s), {$result['updated']} mise(s) à jour.");

        return self::SUCCESS;
    }
}
