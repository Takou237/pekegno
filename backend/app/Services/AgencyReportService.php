<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Prestation;
use App\Models\PrestationAction;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * KPI et rapports du département Agency (cahier §18) : CA hors pass-through,
 * encaissements, créances, revenu récurrent mensuel (MRR), renouvellements,
 * prestations, satisfaction, top commerciaux / packages.
 */
class AgencyReportService
{
    public function __construct(private readonly PrestationReviewService $reviews) {}

    public function report(?string $departmentId, ?string $agencyId, Carbon $from, Carbon $to, ?array $agencyIds = null): array
    {
        $contracts = fn () => DB::table('contracts')
            ->whereNull('contracts.deleted_at')
            ->whereIn('contracts.origin', [Contract::ORIGIN_PACKAGE, Contract::ORIGIN_PRESTATION])
            ->when($departmentId, fn ($q) => $q->where('contracts.department_id', $departmentId))
            ->when($agencyId, fn ($q) => $q->where('contracts.agency_id', $agencyId))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('contracts.agency_id', $agencyIds));

        $prestations = fn () => Prestation::query()
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId))
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds));

        $invoices = fn () => DB::table('invoices')
            ->join('contracts', 'contracts.id', '=', 'invoices.contract_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereNull('contracts.deleted_at')
            ->when($departmentId, fn ($q) => $q->where('contracts.department_id', $departmentId))
            ->when($agencyId, fn ($q) => $q->where('contracts.agency_id', $agencyId))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('contracts.agency_id', $agencyIds));

        [$start, $end] = [$from->copy()->startOfDay(), $to->copy()->endOfDay()];

        $collected = $this->collected($invoices(), $start, $end);

        $receivables = (float) (clone $invoices())->selectRaw('coalesce(sum(invoices.total_amount - invoices.amount_paid), 0) as due')->value('due');

        $statusCounts = (clone $contracts())->selectRaw('contracts.status, count(*) as total')->groupBy('contracts.status')->pluck('total', 'status');

        $activeContracts = (clone $contracts())->whereIn('contracts.status', [Contract::STATUS_ACTIVE, Contract::STATUS_DUE_SOON])
            ->get(['contracts.amount', 'contracts.start_date', 'contracts.end_date']);

        // MRR : montant des contrats en cours ramené à un mois.
        $mrr = round($activeContracts->sum(function ($c) {
            $months = max(1, (int) round(Carbon::parse($c->start_date)->diffInDays(Carbon::parse($c->end_date)) / 30));

            return (float) $c->amount / $months;
        }), 2);

        $endedInPeriod = (clone $contracts())->whereBetween('contracts.end_date', [$start->toDateString(), $end->toDateString()]);
        $endedCount = (clone $endedInPeriod)->count();
        $renewedCount = (clone $endedInPeriod)->whereExists(fn (Builder $q) => $q->selectRaw('1')
            ->from('contracts as child')
            ->whereColumn('child.parent_contract_id', 'contracts.id'))->count();

        $dueSoonCount = (clone $contracts())
            ->whereIn('contracts.status', [Contract::STATUS_ACTIVE, Contract::STATUS_DUE_SOON])
            ->whereBetween('contracts.end_date', [today()->toDateString(), today()->addDays(30)->toDateString()])
            ->count();

        $prestationStatus = (clone $prestations())->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        $prestationIds = (clone $prestations())->pluck('id');

        $overdueActions = PrestationAction::query()
            ->whereIn('prestation_id', $prestationIds)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', today())
            ->whereNotIn('status', PrestationAction::FINISHED_STATUSES)
            ->count();

        $budget = [
            'total' => round((float) (clone $prestations())->whereNotIn('status', [Prestation::STATUS_CANCELLED, Prestation::STATUS_REJECTED])->sum('budget'), 2),
            'allocated' => round((float) PrestationAction::whereIn('prestation_id', $prestationIds)->where('status', '!=', PrestationAction::STATUS_CANCELLED)->sum('budget'), 2),
            'spent' => round((float) PrestationAction::whereIn('prestation_id', $prestationIds)->where('status', '!=', PrestationAction::STATUS_CANCELLED)->sum('actual_cost'), 2),
        ];

        $topCommercials = (clone $contracts())
            ->join('commercials', 'commercials.id', '=', 'contracts.commercial_id')
            ->whereBetween('contracts.created_at', [$start, $end])
            ->selectRaw("commercials.id, commercials.first_name || ' ' || commercials.last_name as name, count(*) as contracts, sum(contracts.amount) as amount")
            ->groupBy('commercials.id', 'commercials.first_name', 'commercials.last_name')
            ->orderByDesc('amount')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'contracts' => (int) $r->contracts, 'amount' => round((float) $r->amount, 2)]);

        $topPackages = (clone $contracts())
            ->join('subscription_packs', 'subscription_packs.id', '=', 'contracts.pack_id')
            ->where('contracts.origin', Contract::ORIGIN_PACKAGE)
            ->whereBetween('contracts.created_at', [$start, $end])
            ->selectRaw('subscription_packs.id, subscription_packs.name, count(*) as contracts, sum(contracts.amount) as amount')
            ->groupBy('subscription_packs.id', 'subscription_packs.name')
            ->orderByDesc('amount')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'contracts' => (int) $r->contracts, 'amount' => round((float) $r->amount, 2)]);

        $revenueByCategory = $this->revenueByCategory($invoices(), $start, $end);

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => [
                'revenue' => $collected['fees'],
                'collected' => $collected['total'],
                'pass_through_collected' => $collected['pass_through'],
                'receivables' => round($receivables, 2),
                'mrr' => $mrr,
                'active_contracts' => (int) (($statusCounts[Contract::STATUS_ACTIVE] ?? 0) + ($statusCounts[Contract::STATUS_DUE_SOON] ?? 0)),
                'contracts_to_renew' => $dueSoonCount,
                'prestations_in_progress' => (int) ($prestationStatus[Prestation::STATUS_IN_PROGRESS] ?? 0),
                'overdue_actions' => $overdueActions,
                'renewal_rate' => $endedCount > 0 ? round($renewedCount / $endedCount * 100, 1) : null,
                'ended_contracts' => $endedCount,
                'renewed_contracts' => $renewedCount,
            ],
            'contracts_by_status' => $statusCounts->map(fn ($v) => (int) $v),
            'prestations_by_status' => $prestationStatus->map(fn ($v) => (int) $v),
            'budget' => $budget,
            'rating' => $this->reviews->aggregate(array_filter(['department_id' => $departmentId, 'agency_id' => $agencyId]), $agencyIds),
            'top_commercials' => $topCommercials,
            'top_packages' => $topPackages,
            'revenue_by_category' => $revenueByCategory,
        ];
    }

    /**
     * Encaissements de la période sur les factures de contrats, répartis entre
     * honoraires et budget publicitaire client (pass-through) au prorata des lignes.
     *
     * @return array{total: float, fees: float, pass_through: float}
     */
    private function collected(Builder $invoices, Carbon $start, Carbon $end): array
    {
        $rows = (clone $invoices)
            ->join('invoice_payments', 'invoice_payments.invoice_id', '=', 'invoices.id')
            ->whereBetween('invoice_payments.paid_at', [$start, $end])
            ->selectRaw('invoices.id, invoices.total_amount, sum(invoice_payments.amount) as paid')
            ->groupBy('invoices.id', 'invoices.total_amount')
            ->get();

        if ($rows->isEmpty()) {
            return ['total' => 0.0, 'fees' => 0.0, 'pass_through' => 0.0];
        }

        $passShares = DB::table('invoice_items')
            ->whereIn('invoice_id', $rows->pluck('id'))
            ->selectRaw('invoice_id, sum(case when is_pass_through then line_total else 0 end) as pass, sum(line_total) as lines')
            ->groupBy('invoice_id')
            ->get()
            ->keyBy('invoice_id');

        $total = 0.0;
        $pass = 0.0;

        foreach ($rows as $row) {
            $paid = (float) $row->paid;
            $share = $passShares[$row->id] ?? null;
            $ratio = $share && (float) $share->lines > 0 ? (float) $share->pass / (float) $share->lines : 0.0;

            $total += $paid;
            $pass += $paid * $ratio;
        }

        return [
            'total' => round($total, 2),
            'fees' => round($total - $pass, 2),
            'pass_through' => round($pass, 2),
        ];
    }

    private function revenueByCategory(Builder $invoices, Carbon $start, Carbon $end): array
    {
        $paid = (clone $invoices)
            ->join('invoice_payments', 'invoice_payments.invoice_id', '=', 'invoices.id')
            ->whereBetween('invoice_payments.paid_at', [$start, $end])
            ->groupBy('invoices.id')
            ->selectRaw('invoices.id as invoice_id, sum(invoice_payments.amount) as amount');

        $lineSums = DB::table('invoice_items')->groupBy('invoice_id')->selectRaw('invoice_id, sum(line_total) as lines_total');

        return DB::table('invoice_items')
            ->joinSub($paid, 'paid', 'paid.invoice_id', '=', 'invoice_items.invoice_id')
            ->joinSub($lineSums, 'sums', 'sums.invoice_id', '=', 'invoice_items.invoice_id')
            ->leftJoin('subscription_packs', 'subscription_packs.id', '=', 'invoice_items.package_id')
            ->leftJoin('prestations', 'prestations.id', '=', 'invoice_items.prestation_id')
            ->leftJoin('agency_categories', 'agency_categories.id', '=', DB::raw('coalesce(subscription_packs.category_id, prestations.category_id)'))
            ->where('invoice_items.is_pass_through', false)
            ->where('sums.lines_total', '>', 0)
            ->selectRaw("coalesce(agency_categories.name, 'Sans catégorie') as sale_category, sum(invoice_items.line_total * paid.amount / sums.lines_total) as total")
            ->groupByRaw("coalesce(agency_categories.name, 'Sans catégorie')")
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => ['category' => $r->sale_category, 'total' => round((float) $r->total, 2)])
            ->all();
    }
}
