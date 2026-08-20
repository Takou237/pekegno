<?php

namespace App\Console\Commands;

use App\Jobs\CheckSubscriptionExpiry;
use Illuminate\Console\Command;

class CheckSubscriptionExpiryCommand extends Command
{
    protected $signature = 'subscriptions:check-expiry';

    protected $description = 'Envoie les rappels d\'expiration d\'abonnement configurés (14/7/2/1/0 jours)';

    public function handle(CheckSubscriptionExpiry $job): int
    {
        $job->handle();

        $this->info('Rappels d\'abonnement traités.');

        return self::SUCCESS;
    }
}