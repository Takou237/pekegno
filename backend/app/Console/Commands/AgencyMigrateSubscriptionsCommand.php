<?php

namespace App\Console\Commands;

use App\Services\SubscriptionMigrationService;
use Illuminate\Console\Command;

/**
 * D16 : reprise de tout l'historique des abonnements en contrats Agency.
 * À lancer UNIQUEMENT après validation (tester d'abord avec --dry-run).
 */
class AgencyMigrateSubscriptionsCommand extends Command
{
    protected $signature = 'agency:migrate-subscriptions {--dry-run : Simule la reprise sans rien écrire}';

    protected $description = 'Reprend tous les abonnements (historique complet) en contrats Agency — idempotent';

    public function handle(SubscriptionMigrationService $migration): int
    {
        $dryRun = (bool) $this->option('dry-run');

        if (! $dryRun && ! $this->confirm('Reprendre tous les abonnements en contrats ? (pensez à sauvegarder la base)', false)) {
            $this->warn('Reprise annulée.');

            return self::FAILURE;
        }

        $result = $migration->migrate($dryRun);

        $this->info(($dryRun ? '[SIMULATION] ' : '')."Repris : {$result['migrated']} · Déjà repris : {$result['skipped']} · Anomalies : ".count($result['anomalies']));

        foreach ($result['anomalies'] as $anomaly) {
            $this->warn(' - '.$anomaly);
        }

        return self::SUCCESS;
    }
}
