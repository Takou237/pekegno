<?php

namespace App\Console\Commands;

use App\Services\OverdueInvoiceNotifier;
use Illuminate\Console\Command;

/**
 * Lot 7 — déclencheur quotidien des notifications « créance échue ».
 */
class CheckOverdueInvoicesCommand extends Command
{
    protected $signature = 'invoices:check-overdue';

    protected $description = 'Notifie les créances échues (factures validées, non soldées, dont l\'échéance est dépassée).';

    public function handle(OverdueInvoiceNotifier $notifier): int
    {
        $result = $notifier->run();

        $this->info("Créances échues : {$result['overdue']} — notifications créées : {$result['notified']}");

        return self::SUCCESS;
    }
}
