<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\CommercialPoint;
use App\Models\Invoice;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class PointsService
{
    /**
     * Attribue les points de vente d'une facture payée intégralement (règle plan §2.4).
     * Idempotent via invoice.points_awarded.
     */
    public function awardForSale(Invoice $invoice, ?string $actorUserId = null): void
    {
        if ($invoice->points_awarded > 0 || $invoice->commercial_id === null) {
            return;
        }

        $points = (int) Setting::get('sales_points_per_sale', 3);

        DB::transaction(function () use ($invoice, $points, $actorUserId) {
            $invoice->update(['points_awarded' => $points]);

            CommercialPoint::create([
                'commercial_id' => $invoice->commercial_id,
                'points' => $points,
                'reason' => 'sale',
                'invoice_id' => $invoice->id,
                'created_by' => $actorUserId,
            ]);

            $this->recomputeBalance($invoice->commercial);
        });
    }

    public function recomputeBalance(Commercial $commercial): void
    {
        $commercial->update([
            'points_balance' => (int) $commercial->points()->sum('points'),
        ]);
    }

    /**
     * Applique la pénalité d'inactivité (règle plan §2.2) et recalcule le solde.
     */
    public function applyInactivityPenalty(Commercial $commercial, ?string $actorUserId = null): void
    {
        $penalty = (int) Setting::get('inactivity_penalty_points', 5);

        DB::transaction(function () use ($commercial, $penalty, $actorUserId) {
            CommercialPoint::create([
                'commercial_id' => $commercial->id,
                'points' => -$penalty,
                'reason' => 'penalty',
                'created_by' => $actorUserId,
            ]);

            $this->recomputeBalance($commercial);
        });
    }
}
