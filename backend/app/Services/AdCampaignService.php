<?php

namespace App\Services;

use App\Models\AdCampaign;
use App\Models\Agency;
use App\Support\Money;
use App\Support\Period;
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
    public function getAgencyAdCosts(Agency $agency, Carbon $from, Carbon $to, ?string $branch = null): array
    {
        // Campagnes en cours ou terminées (une campagne finie reste dans
        // l'historique des mois qu'elle a couverts) ; brouillons et annulées exclues.
        $campaigns = AdCampaign::query()
            ->where('country_id', $agency->country_id)
            ->whereIn('status', [AdCampaign::STATUS_ACTIVE, AdCampaign::STATUS_COMPLETED])
            ->when($branch, fn ($q) => $q->where('branch', $branch))
            ->whereDate('start_date', '<=', $to->toDateString())
            ->where(fn ($q) => $q->whereNull('end_date')->orWhereDate('end_date', '>=', $from->toDateString()))
            ->get();

        $localTotal = 0.0;
        $nationalTotal = 0.0;
        $details = [];

        foreach ($campaigns as $campaign) {
            // Part du budget qui tombe dans la période (au prorata des jours) :
            // une campagne de 3 mois ne pèse qu'un tiers sur chaque mois.
            [$overlapFrom, $overlapTo, $periodShare] = $this->periodShare($campaign, $from, $to);
            $budget = (float) $campaign->budget * $periodShare;
            if ($budget <= 0) {
                continue;
            }

            if (! $campaign->is_national) {
                // Campagne locale
                if ($campaign->agency_id === $agency->id) {
                    $localTotal += $budget;
                    $details[] = [
                        'campaign_id' => $campaign->id,
                        'name' => $campaign->name,
                        'branch' => $campaign->branch,
                        'type' => 'local',
                        'allocated_amount' => Money::franc($budget),
                        'ratio' => 1.0,
                    ];
                }
            } else {
                // Campagne nationale -> répartition au prorata du CA de la branche
                $allocation = $this->calculateNationalShare($campaign, $agency, $overlapFrom, $overlapTo, $budget);
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
     * Fenêtre commune campagne / période et part du budget correspondante
     * (jours de la fenêtre ÷ jours de la campagne). Sans date de fin : tout le
     * budget à partir du début.
     *
     * @return array{0: Carbon, 1: Carbon, 2: float}
     */
    private function periodShare(AdCampaign $campaign, Carbon $from, Carbon $to): array
    {
        $start = $campaign->start_date->copy()->startOfDay();
        $end = ($campaign->end_date ?? $campaign->start_date)->copy()->endOfDay();
        $overlapFrom = $from->copy()->max($start);
        $overlapTo = $to->copy()->min($end);

        if ($overlapFrom->gt($overlapTo)) {
            return [$overlapFrom, $overlapTo, 0.0];
        }
        if ($campaign->end_date === null) {
            return [$overlapFrom, $overlapTo, 1.0];
        }

        // Les bornes de la période arrivent en UTC (ex. 1er novembre 00:00 à
        // Douala = 31 octobre 23:00 UTC) : compter les jours du calendrier
        // métier, sinon le prorata gagne un jour (14 jours au lieu de 13, 31 au
        // lieu de 30) et une campagne de 2 mois pèse 62 000 au lieu de 61 000.
        $tz = Period::businessTimezone();
        $businessDay = function (Carbon $instant) use ($tz): Carbon {
            return Carbon::parse($instant->copy()->setTimezone($tz)->toDateString(), $tz)->startOfDay();
        };
        $campaignDays = Carbon::parse($start->toDateString(), $tz)
            ->diffInDays(Carbon::parse($end->toDateString(), $tz)) + 1;
        $overlapDays = $businessDay($overlapFrom)->diffInDays($businessDay($overlapTo)) + 1;

        return [$overlapFrom, $overlapTo, min(1.0, $overlapDays / max(1, $campaignDays))];
    }

    /**
     * Calcule la part d'une agence sur une campagne nationale au prorata du CA de la branche.
     *
     * @return array{allocated_amount: float, ratio: float, agency_ca: float, total_ca: float}
     */
    public function calculateNationalShare(AdCampaign $campaign, Agency $agency, Carbon $from, Carbon $to, ?float $budget = null): array
    {
        $branch = $campaign->branch;
        $budget ??= (float) $campaign->budget;

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
