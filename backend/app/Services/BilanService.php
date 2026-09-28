<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\DailyBalance;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BilanService
{
    /**
     * Bilan journalier — agence unique ou globale.
     */
    public function daily(Carbon $date, ?string $agencyId): array
    {
        return $this->buildSingleDay($date, $agencyId);
    }

    /**
     * Bilan sur une plage de dates (une entrée par jour).
     */
    public function period(Carbon $from, Carbon $to, ?string $agencyId, ?array $agencyIds = null): array
    {
        $days = [];
        $current = $date = $from->copy();

        while ($current->lte($to)) {
            $days[] = $this->buildSingleDay($current, $agencyId, $agencyIds);
            $current->addDay();
        }

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null,
            'days' => $days,
        ];
    }

    /**
     * Bilan consolidé — agences autorisées, une seule date.
     */
    public function consolidated(Carbon $date, ?array $agencyIds = null): array
    {
        $agencies = Agency::whereNull('deleted_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->get();

        $agencyBilans = [];
        $totals = [
            'total_ventes' => 0,
            'total_ventes_amount' => 0,
            'total_formations' => 0,
            'total_encaisse' => 0,
            'total_cash' => 0,
            'total_om' => 0,
            'total_momo' => 0,
            'total_mobile' => 0,
            'total_depenses' => 0,
            'total_solde_final' => 0,
        ];

        $expenseByCategory = [];

        foreach ($agencies as $agency) {
            $b = $this->buildSingleDay($date, $agency->id);
            $agencyBilans[] = $b;

            $totals['total_ventes'] += $b['total_ventes'];
            $totals['total_ventes_amount'] += $b['total_ventes_amount'];
            $totals['total_formations'] += $b['formation_total'];
            $totals['total_encaisse'] += $b['total_received'];
            $totals['total_cash'] += $b['cash_total'];
            $totals['total_om'] += $b['om_total'];
            $totals['total_momo'] += $b['momo_total'];
            $totals['total_mobile'] += $b['mobile_total'];
            $totals['total_depenses'] += $b['expense_total'];
            $totals['total_solde_final'] += $b['solde_final'];

            foreach ($b['expenses_by_category'] as $cat) {
                $key = $cat['name'];
                if (! isset($expenseByCategory[$key])) {
                    $expenseByCategory[$key] = ['name' => $key, 'total' => 0];
                }
                $expenseByCategory[$key]['total'] += $cat['total'];
            }
        }

        return [
            'date' => $date->toDateString(),
            'agency_id' => null,
            'agency' => null,
            'agencies' => $agencyBilans,
            'totals' => $totals,
            'expenses_by_category' => array_values($expenseByCategory),
        ];
    }

    /**
     * Construit le bilan complet d'un seul jour.
     */
    private function buildSingleDay(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $servicesByCategory = $this->servicesByCategory($date, $agencyId, $agencyIds);
        $productsByCategory = $this->productsByCategory($date, $agencyId, $agencyIds);
        $formationSales = $this->formationSales($date, $agencyId, $agencyIds);
        $received = $this->receivedByMode($date, $agencyId, $agencyIds);

        $cash = (float) ($received['cash'] ?? 0);
        $om = (float) ($received['om'] ?? 0);
        $momo = (float) ($received['momo'] ?? 0);
        $mobile = (float) ($received['mobile'] ?? 0);

        $totalReceived = $cash + $om + $momo + $mobile;
        $totalVentes = (int) (
            collect($servicesByCategory)->sum('count')
            + collect($productsByCategory)->sum('count')
            + $formationSales['count']
        );
        $totalVentesAmount = round(
            (float) collect($servicesByCategory)->sum('total')
            + (float) collect($productsByCategory)->sum('total')
            + $formationSales['total'],
            2
        );

        $expensesByCategory = $this->expensesByCategory($date, $agencyId, $agencyIds);
        $expenseTotal = collect($expensesByCategory)->sum('total');

        $opening = $this->openingBalance($date, $agencyId, $agencyIds);
        $closing = $opening + $totalReceived - $expenseTotal;

        if ($agencyId !== null || $agencyIds === null) {
            $this->storeBalance($date, $agencyId, $opening, $closing);
        }

        $agency = $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null;

        // Solde réel trésorerie (tous les comptes de l'agence)
        $treasuryBalance = $this->treasuryBalance($date, $agencyId, $agencyIds);

        // Écart entre solde théorique et solde réel
        $gap = $treasuryBalance !== null ? round($closing - $treasuryBalance, 2) : null;
        $gapPercent = $treasuryBalance !== null && abs($treasuryBalance) > 0
            ? round(($gap / abs($treasuryBalance)) * 100, 2)
            : null;

        return [
            'date' => $date->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agency,
            'services_by_category' => $servicesByCategory,
            'products_by_category' => $productsByCategory,
            'formation_count' => $formationSales['count'],
            'formation_total' => $formationSales['total'],
            'total_ventes' => $totalVentes,
            'total_ventes_amount' => $totalVentesAmount,
            'cash_total' => $cash,
            'om_total' => $om,
            'momo_total' => $momo,
            'mobile_total' => $mobile,
            'total_received' => $totalReceived,
            'expense_total' => (float) $expenseTotal,
            'expenses_by_category' => $expensesByCategory,
            'solde_initial' => $opening,
            'solde_final' => $closing,
            'treasury_balance' => $treasuryBalance,
            'gap' => $gap,
            'gap_percent' => $gapPercent,
        ];
    }

    /**
     * Solde réel de la trésorerie (tous les comptes actifs d'une agence).
     */
    private function treasuryBalance(Carbon $date, ?string $agencyId, ?array $agencyIds = null): ?float
    {
        $accounts = TreasuryAccount::active()
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->get();

        if ($accounts->isEmpty()) {
            return null;
        }

        $total = 0.0;
        foreach ($accounts as $account) {
            $in = TreasuryTransaction::ofAccount($account->id)
                ->where('transacted_at', '<=', $date->endOfDay())
                ->where('direction', 'in')
                ->sum('amount');
            $out = TreasuryTransaction::ofAccount($account->id)
                ->where('transacted_at', '<=', $date->endOfDay())
                ->where('direction', 'out')
                ->sum('amount');

            $total += (float) $account->opening_balance + (float) $in - (float) $out;
        }

        return round($total, 2);
    }

    /**
     * Ventes groupées par catégorie de service (dynamique).
     *
     * Les lignes liées à une inscription de formation (service_id null + rattachement
     * via formation_enrollments) sont exclues : elles sont comptées séparément
     * dans la colonne « Formations ».
     */
    private function servicesByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->leftJoin('services', 'services.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories', 'categories.id', '=', 'services.category_id')
            ->leftJoin('formation_enrollments', function ($join) {
                $join->on('formation_enrollments.invoice_id', '=', 'invoice_items.invoice_id')
                    ->whereNull('invoice_items.service_id')
                    ->whereNull('invoice_items.product_id');
            })
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereNull('invoice_items.product_id')
            ->whereNull('formation_enrollments.id')
            ->whereDate('invoices.invoice_date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw("
                coalesce(categories.name, 'Autres') as category,
                coalesce(invoice_items.label, '') as label,
                sum(invoice_items.quantity) as count,
                sum(invoice_items.line_total) as total
            ")
            ->groupBy('category', 'label')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'label' => $row->label,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    /**
     * Ventes de produits groupées par catégorie (dynamique).
     */
    private function productsByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->leftJoin('products', 'products.id', '=', 'invoice_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->whereNotNull('invoice_items.product_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereDate('invoices.invoice_date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw("
                coalesce(categories.name, 'Autres') as category,
                coalesce(invoice_items.label, '') as label,
                sum(invoice_items.quantity) as count,
                sum(invoice_items.line_total) as total
            ")
            ->groupBy('category', 'label')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'label' => $row->label,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    /**
     * Ventes de formations (inscriptions) du jour.
     *
     * Le montant vient de la facture générée par l'inscription (hors lignes de
     * la facture pour éviter le double comptage avec produits/services éventuels).
     */
    private function formationSales(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $rows = DB::table('formation_enrollments')
            ->join('invoices', 'invoices.id', '=', 'formation_enrollments.invoice_id')
            ->leftJoin('courses', 'courses.id', '=', 'formation_enrollments.course_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereDate('invoices.invoice_date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw('coalesce(courses.mode, ?) as mode, count(distinct formation_enrollments.id) as count', ['in_person'])
            ->groupBy('mode')
            ->get();

        $total = (float) DB::table('formation_enrollments')
            ->join('invoices', 'invoices.id', '=', 'formation_enrollments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereDate('invoices.invoice_date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw(
                'sum(case when invoices.total_amount - coalesce((select sum(ii.line_total) from invoice_items ii where ii.invoice_id = invoices.id and (ii.service_id is not null or ii.product_id is not null)), 0) > 0
                    then invoices.total_amount - coalesce((select sum(ii.line_total) from invoice_items ii where ii.invoice_id = invoices.id and (ii.service_id is not null or ii.product_id is not null)), 0)
                    else 0 end) as total'
            )
            ->value('total');

        $count = (int) $rows->sum('count');

        return [
            'count' => $count,
            'total' => round($total, 2),
            'by_mode' => $rows->map(fn ($row) => [
                'mode' => $row->mode,
                'count' => (int) $row->count,
            ])->values()->all(),
        ];
    }

    /**
     * Encaissements ventilés par mode: cash, om, momo, mobile.
     */
    private function receivedByMode(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereDate('invoice_payments.paid_at', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw('invoice_payments.payment_method, sum(invoice_payments.amount) as total')
            ->groupBy('invoice_payments.payment_method')
            ->pluck('total', 'invoice_payments.payment_method')
            ->map(fn ($total) => round((float) $total, 2))
            ->all();
    }

    /**
     * Dépenses groupées par catégorie (dynamique).
     */
    private function expensesByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('accounting_transactions')
            ->leftJoin('accounting_categories', 'accounting_categories.id', '=', 'accounting_transactions.category_id')
            ->where('accounting_transactions.type', 'expense')
            ->whereDate('accounting_transactions.transacted_at', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('accounting_transactions.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('accounting_transactions.agency_id', $agencyIds))
            ->selectRaw("
                coalesce(accounting_categories.name, 'Autres') as name,
                sum(accounting_transactions.amount) as total
            ")
            ->groupBy('name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    private function openingBalance(Carbon $date, ?string $agencyId, ?array $agencyIds = null): float
    {
        $previous = $date->copy()->subDay();

        $stored = DailyBalance::query()
            ->where('date', $previous->toDateString())
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId), fn ($q) => $q->whereNull('agency_id'))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->first();

        if ($stored) {
            return (float) $stored->solde_final;
        }

        $received = $this->receivedByMode($previous, $agencyId, $agencyIds);

        return (float) array_sum($received);
    }

    private function storeBalance(Carbon $date, ?string $agencyId, float $opening, float $closing): DailyBalance
    {
        $balance = DailyBalance::query()
            ->where('date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId), fn ($q) => $q->whereNull('agency_id'))
            ->first();

        if ($balance) {
            $balance->update([
                'solde_initial' => $opening,
                'solde_final' => $closing,
            ]);

            return $balance;
        }

        return DailyBalance::create([
            'agency_id' => $agencyId,
            'date' => $date->toDateString(),
            'solde_initial' => $opening,
            'solde_final' => $closing,
        ]);
    }
}
