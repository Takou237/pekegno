<?php

namespace App\Services;

use App\Models\AdCampaign;
use App\Models\Agency;
use App\Support\Money;
use App\Support\SaleBranch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * T3.8 – T3.11 — Publicité Pekegno (campagnes locales et nationales).
 *
 * Campagne locale : imputée à 100 % à l'agence de la ville ciblée.
 * Campagne nationale : répartie mensuellement au prorata du Chiffre d'Affaires
 * de la branche concernée par agence.
 */
class AdCampaignService
{
    public function __construct(
        private readonly FinancialMetricsService $financialMetrics
    ) {}

    /**
     * Répartition des dépenses publicitaires pour une agence sur une période.
     *
     * Retourne :
     * - local_ads : total des campagnes locales affectées à cette agence
     * - national_ads : quote-part des campagnes nationales réparties au prorata du CA de chaque branche
     * - total_ads : local_ads + national_ads
     * - details : détail par campagne
     *
     * @return array{local_ads: float, national_ads: float, total_ads: float, details: array}
     */
    public function getAgencyAdCosts(Agency $agency, Carbon $from, Carbon $to): array
    {
        $campaigns = AdCampaign::query()
            ->where('country_id', $agency->country_id)
            ->where('status', AdCampaign::STATUS_ACTIVE)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('start_date', [$from->toDateString(), $to->toDateString()])
                    ->orWhereBetween('end_date', [$from->toDateString(), $to->toDateString()])
                    ->orWhere(function ($sub) use ($from, $to) {
                        $sub->where('start_date', '<=', $from->toDateString())
                            ->where('end_date', '>=', $to->toDateString());
                    });
            })
            ->get();

        $localTotal = 0.0;
        $nationalTotal = 0.0;
        $details = [];

        foreach ($campaigns as $campaign) {
            $budget = (float) $campaign->budget;

            if (! $campaign->is_national) {
                // Campagne locale
                if ($campaign->agency_id === $agency->id) {
                    $localTotal += $budget;
                    $details[] = [
                        'campaign_id' => $campaign->id,
                        'name' => $campaign->name,
                        'branch' => $campaign->branch,
                        'type' => 'local',
                        'allocated_amount' => $budget,
                        'ratio' => 1.0,
                    ];
                }
            } else {
                // Campagne nationale -> répartition au prorata du CA de la branche
                $allocation = $this->calculateNationalShare($campaign, $agency, $from, $to);
                if ($allocation['allocated_amount'] > 0) {
                    $nationalTotal += $allocation['allocated_amount'];
                    $details[] = [
                        'campaign_id' => $campaign->id,
                        'name' => $campaign->name,
                        'branch' => $campaign->branch,
                        'type' => 'national',
                        'allocated_amount' => $allocation['allocated_amount'],
                        'ratio' => $allocation['ratio'],
                    ];
                }
            }
        }

        $localTotal = Money::franc($localTotal);
        $nationalTotal = Money::franc($nationalTotal);

        return [
            'local_ads' => $localTotal,
            'national_ads' => $nationalTotal,
            'total_ads' => Money::franc($localTotal + $nationalTotal),
            'details' => $details,
        ];
    }

    /**
     * Calcule la part d'une agence sur une campagne nationale au prorata du CA de la branche.
     *
     * @return array{allocated_amount: float, ratio: float, agency_ca: float, total_ca: float}
     */
    public function calculateNationalShare(AdCampaign $campaign, Agency $agency, Carbon $from, Carbon $to): array
    {
        $branch = $campaign->branch;
        $budget = (float) $campaign->budget;

        // Récupérer le CA par agence sur cette branche pour la période
        $caByAgency = $this->getBranchRevenueByAgency($campaign->country_id, $branch, $from, $to);

        $totalBranchCa = array_sum($caByAgency);
        $agencyCa = $caByAgency[$agency->id] ?? 0.0;

        if ($totalBranchCa <= 0) {
            // S'il n'y a pas encore de CA sur la période, répartition égale entre les agences du pays
            $agencyCount = Agency::where('country_id', $campaign->country_id)->count();
            $ratio = $agencyCount > 0 ? (1.0 / $agencyCount) : 0.0;
        } else {
            $ratio = $agencyCa / $totalBranchCa;
        }

        $allocatedAmount = Money::franc($budget * $ratio);

        return [
            'allocated_amount' => $allocatedAmount,
            'ratio' => round($ratio, 4),
            'agency_ca' => $agencyCa,
            'total_ca' => $totalBranchCa,
        ];
    }

    /**
     * Chiffre d'affaires facturé validé hors pass-through, ventilé par agence pour une branche donnée.
     *
     * @return array<string, float> agency_id => CA
     */
    public function getBranchRevenueByAgency(string $countryId, string $branch, Carbon $from, Carbon $to): array
    {
        $query = DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->join('agencies', 'agencies.id', '=', 'invoices.agency_id')
            ->where('agencies.country_id', $countryId)
            ->where('invoices.validation_status', 'validated')
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoices.invoice_date', [$from->toDateString(), $to->toDateString()])
            ->where(function ($q) {
                $q->whereNull('invoice_items.is_pass_through')
                    ->orWhere('invoice_items.is_pass_through', false);
            });

        SaleBranch::joinCatalog($query);

        $query->whereRaw(SaleBranch::branchSql().' = ?', [$branch]);

        $results = $query
            ->select('invoices.agency_id', DB::raw('SUM(invoice_items.line_total) as total'))
            ->groupBy('invoices.agency_id')
            ->get();

        $map = [];
        foreach ($results as $row) {
            $map[$row->agency_id] = (float) $row->total;
        }

        return $map;
    }
}
