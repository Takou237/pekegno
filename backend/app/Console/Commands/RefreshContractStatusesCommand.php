<?php

namespace App\Console\Commands;

use App\Services\ContractService;
use Illuminate\Console\Command;

/**
 * B20 : recalcule les statuts des contrats (expirés, à renouveler) sans
 * attendre l'ouverture d'un écran.
 */
class RefreshContractStatusesCommand extends Command
{
    protected $signature = 'contracts:refresh-status';

    protected $description = 'Contrats : marque les expirés et les contrats à renouveler';

    public function handle(ContractService $contracts): int
    {
        $result = $contracts->refreshStatuses();

        $this->info("Expirés : {$result['expired']} · À renouveler : {$result['due_soon']}");

        return self::SUCCESS;
    }
}
