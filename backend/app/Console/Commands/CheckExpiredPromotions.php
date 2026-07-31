<?php

namespace App\Console\Commands;

use App\Models\Promotion;
use Illuminate\Console\Command;

class CheckExpiredPromotions extends Command
{
    protected $signature = 'promotions:check-expired';

    protected $description = 'Désactive les promotions dont la date de fin est dépassée.';

    public function handle(): int
    {
        $count = Promotion::query()
            ->where('is_active', true)
            ->where('end_date', '<', now())
            ->update(['is_active' => false]);

        $this->info("{$count} promotion(s) expirée(s) désactivée(s).");

        return self::SUCCESS;
    }
}
