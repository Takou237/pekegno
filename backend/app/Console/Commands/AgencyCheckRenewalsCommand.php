<?php

namespace App\Console\Commands;

use App\Services\AgencyAlertService;
use Illuminate\Console\Command;

/**
 * Agency : automatisations quotidiennes (renouvellements J-30/15/7/1,
 * expiration des contrats, actions en retard).
 */
class AgencyCheckRenewalsCommand extends Command
{
    protected $signature = 'agency:check-renewals';

    protected $description = 'Contrats Agency : statut « à renouveler », alertes chef d\'agence + client, expirations, actions en retard';

    public function handle(AgencyAlertService $alerts): int
    {
        $result = $alerts->run();

        $this->info("À renouveler : {$result['due_soon']} · Alertes envoyées : {$result['alerts']} · Expirés : {$result['expired']} · Actions en retard : {$result['overdue_actions']}");

        return self::SUCCESS;
    }
}
