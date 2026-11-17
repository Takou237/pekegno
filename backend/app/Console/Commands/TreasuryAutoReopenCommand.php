<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\CashClosingService;
use App\Support\Period;
use Illuminate\Console\Command;

/**
 * Point 14b : réouverture automatique de toutes les caisses à l'heure réglée
 * (07:00 par défaut). Appelée chaque minute par le planificateur.
 */
class TreasuryAutoReopenCommand extends Command
{
    protected $signature = 'treasury:auto-reopen';

    protected $description = 'Rouvre automatiquement toutes les caisses à l\'heure réglée';

    public function handle(CashClosingService $service): int
    {
        if (! Setting::get('cash_auto_closing_enabled', true)) {
            return self::SUCCESS;
        }

        $target = substr((string) Setting::get('cash_reopening_time', '07:00'), 0, 5);
        if (now()->timezone(Period::businessTimezone())->format('H:i') !== $target) {
            return self::SUCCESS;
        }

        $result = $service->reopenAll(null);

        $this->info("Caisses rouvertes : {$result['reopened']}");

        return self::SUCCESS;
    }
}
