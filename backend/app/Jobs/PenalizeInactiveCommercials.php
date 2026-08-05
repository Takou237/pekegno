<?php

namespace App\Jobs;

use App\Models\Commercial;
use App\Models\Setting;
use App\Services\PointsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

class PenalizeInactiveCommercials implements ShouldQueue
{
    use Queueable;

    /**
     * Retire les points aux commerciaux sans vente payée depuis la période configurée (plan §2.2).
     */
    public function handle(PointsService $pointsService): void
    {
        $periodDays = (int) Setting::get('inactivity_period_days', 14);
        $deadline = Carbon::now()->subDays($periodDays);

        $inactive = Commercial::where('is_active', true)
            ->whereDoesntHave('invoices', function ($q) use ($deadline) {
                $q->where('status', 'paid')->where('cancelled_at', null)->where('invoice_date', '>=', $deadline);
            })
            ->get();

        foreach ($inactive as $commercial) {
            $pointsService->applyInactivityPenalty($commercial);
        }
    }
}
