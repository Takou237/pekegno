<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\CashClosingService;
use App\Support\Period;
use Illuminate\Console\Command;

/**
 * Point 14b : clôture automatique de toutes les caisses à l'heure réglée
 * (22:00 par défaut). L'heure est configurable dans Paramètres ; la commande
 * est appelée chaque minute par le planificateur et ne fait rien hors de
 * l'heure cible.
 */
class TreasuryAutoCloseCommand extends Command
{
    protected $signature = 'treasury:auto-close';

    protected $description = 'Clôture automatiquement toutes les caisses à l\'heure réglée';

    public function handle(CashClosingService $service): int
    {
        if (! Setting::get('cash_auto_closing_enabled', true)) {
            return self::SUCCESS;
        }

        $target = substr((string) Setting::get('cash_closing_time', '22:00'), 0, 5);
        if (now()->timezone(Period::businessTimezone())->format('H:i') !== $target) {
            return self::SUCCESS;
        }

        $result = $service->closeAll(null);

        $this->info("Caisses clôturées : {$result['closed']} — déjà fermées : {$result['skipped']}");

        return self::SUCCESS;
    }
}
