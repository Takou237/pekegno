<?php

namespace App\Services;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\DailyBalance;
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
    public function period(Carbon $from, Carbon $to, ?string $agencyId): array
    {
        $days = [];
        $current = $date = $from->copy();

        while ($current->lte($to)) {
            $days[] = $this->buildSingleDay($current, $agencyId);
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
     * Bilan consolidé — toutes agences, une seule date.
     */
    public function consolidated(Carbon $date): array
    {
        $agencies = Agency::whereNull('deleted_at')->get();

        $agencyBilans = [];
        $totals = [
            'total_ventes' => 0,
            'total_encaisse' => 0,
            'total_cash' => 0,
            'total_om' => 0,
            'total_momo' => 0,
            'total_depenses' => 0,
            'total_solde_final' => 0,
        ];

        $expenseByCategory = [];

        foreach ($agencies as $agency) {
            $b = $this->buildSingleDay($date, $agency->id);
            $agencyBilans[] = $b;

            $totals['total_ventes'] += $b['total_ventes'];
            $totals['total_encaisse'] += $b['total_received'];
            $totals['total_cash'] += $b['cash_total'];
            $totals['total_om'] += $b['om_total'];
            $totals['total_momo'] += $b['momo_total'];
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
    private function buildSingleDay(Carbon $date, ?string $agencyId): array
    {
        $servicesByCategory = $this->servicesByCategory($date, $agencyId);
        $received = $this->receivedByMode($date, $agencyId);

        $cash = (float) ($received['cash'] ?? 0);
        $om = (float) ($received['om'] ?? 0);
        $momo = (float) ($received['momo'] ?? 0);

        $totalReceived = $cash + $om + $momo;
        $totalVentes = (int) collect($servicesByCategory)->sum('count');

        $expensesByCategory = $this->expensesByCategory($date, $agencyId);
        $expenseTotal = collect($expensesByCategory)->sum('total');

        $opening = $this->openingBalance($date, $agencyId);
        $closing = $opening + $totalReceived - $expenseTotal;

        $this->storeBalance($date, $agencyId, $opening, $closing);

        $agency = $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null;

        return [
            'date' => $date->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agency,
            'services_by_category' => $servicesByCategory,
            'total_ventes' => $totalVentes,
            'cash_total' => $cash,
            'om_total' => $om,
            'momo_total' => $momo,
            'total_received' => $totalReceived,
            'expense_total' => (float) $expenseTotal,
            'expenses_by_category' => $expensesByCategory,
            'solde_initial' => $opening,
            'solde_final' => $closing,
        ];
    }

    /**
     * Ventes groupées par catégorie de service (dynamique).
     */
    private function servicesByCategory(Carbon $date, ?string $agencyId): array
    {
        return DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->leftJoin('services', 'services.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories', 'categories.id', '=', 'services.category_id')
            ->whereNull('invoices.cancelled_at')
            ->whereDate('invoices.invoice_date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
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
     * Encaissements ventilés par mode: cash, om, momo, mobile.
     */
    private function receivedByMode(Carbon $date, ?string $agencyId): array
    {
        return DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->whereDate('invoice_payments.paid_at', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->selectRaw('invoice_payments.payment_method, sum(invoice_payments.amount) as total')
            ->groupBy('invoice_payments.payment_method')
            ->pluck('total', 'invoice_payments.payment_method')
            ->map(fn ($total) => round((float) $total, 2))
            ->all();
    }

    /**
     * Dépenses groupées par catégorie (dynamique).
     */
    private function expensesByCategory(Carbon $date, ?string $agencyId): array
    {
        return DB::table('accounting_transactions')
            ->leftJoin('accounting_categories', 'accounting_categories.id', '=', 'accounting_transactions.category_id')
            ->where('accounting_transactions.type', 'expense')
            ->whereDate('accounting_transactions.transacted_at', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('accounting_transactions.agency_id', $agencyId))
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

    private function openingBalance(Carbon $date, ?string $agencyId): float
    {
        $previous = $date->copy()->subDay();

        $stored = DailyBalance::query()
            ->where('date', $previous->toDateString())
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId), fn ($q) => $q->whereNull('agency_id'))
            ->first();

        if ($stored) {
            return (float) $stored->solde_final;
        }

        $received = $this->receivedByMode($previous, $agencyId);

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
