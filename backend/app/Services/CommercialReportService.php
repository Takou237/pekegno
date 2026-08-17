<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\CommercialPoint;
use App\Models\CommissionPayment;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Prospect;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class CommercialReportService
{
    /**
     * Rapport agrégé par commercial/employé sur une période.
     *
     * Métriques par commercial :
     * - ventes et CA facturé (factures non annulées dont la date est dans la période) ;
     * - CA encaissé et nombre de tranches (paiements encaissés dans la période) ;
     * - commissions versées par tranche (commission_payments liés aux paiements de la période) ;
     * - points gagnés (points attribués dans la période) ;
     * - prospects créés dans la période ;
     * - clients convertis : clients distincts facturés dans la période ;
     * - taux de conversion : clients convertis / (clients convertis + prospects créés).
     *
     * @param  array<int, string>|null  $allowedAgencyIds  agences autorisées (scope rôle), null = toutes
     */
    public function report(
        ?string $agencyId,
        ?string $commercialId,
        ?string $kind,
        Carbon $from,
        Carbon $to,
        ?array $allowedAgencyIds = null,
    ): array {
        $commercials = Commercial::query()
            ->with('agency:id,name')
            ->when($agencyId, fn (Builder $q, $id) => $q->where('agency_id', $id))
            ->when($allowedAgencyIds !== null, fn (Builder $q) => $q->whereIn('agency_id', $allowedAgencyIds))
            ->when($commercialId, fn (Builder $q, $id) => $q->whereKey($id))
            ->when($kind, fn (Builder $q, string $k) => $q->kind($k))
            ->orderBy('last_name')
            ->get(['id', 'agency_id', 'kind', 'first_name', 'last_name', 'email', 'points_balance']);

        if ($commercials->isEmpty()) {
            return [
                'period' => [
                    'from' => $from->toISOString(),
                    'to' => $to->toISOString(),
                ],
                'totals' => $this->emptyTotals(),
                'ranking' => [],
            ];
        }

        $ids = $commercials->pluck('id');

        $invoices = Invoice::query()
            ->whereNull('cancelled_at')
            ->whereIn('commercial_id', $ids)
            ->whereBetween('invoice_date', [$from, $to])
            ->selectRaw('commercial_id, count(*) as sales_count, sum(total_amount) as revenue_billed, count(distinct client_id) as clients_converted')
            ->groupBy('commercial_id')
            ->get()
            ->keyBy('commercial_id');

        $payments = InvoicePayment::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereIn('invoices.commercial_id', $ids)
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoice_payments.paid_at', [$from, $to])
            ->selectRaw('invoices.commercial_id, count(*) as payments_count, sum(invoice_payments.amount) as revenue_received')
            ->groupBy('invoices.commercial_id')
            ->get()
            ->keyBy('commercial_id');

        $commissions = CommissionPayment::query()
            ->join('invoice_payments', 'invoice_payments.id', '=', 'commission_payments.payment_id')
            ->whereIn('commission_payments.commercial_id', $ids)
            ->whereBetween('invoice_payments.paid_at', [$from, $to])
            ->selectRaw('commission_payments.commercial_id, sum(commission_payments.amount) as commissions')
            ->groupBy('commission_payments.commercial_id')
            ->get()
            ->keyBy('commercial_id');

        $points = CommercialPoint::query()
            ->whereIn('commercial_id', $ids)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('commercial_id, sum(points) as points')
            ->groupBy('commercial_id')
            ->get()
            ->keyBy('commercial_id');

        $prospects = Prospect::query()
            ->whereIn('commercial_id', $ids)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('commercial_id, count(*) as prospects_count')
            ->groupBy('commercial_id')
            ->get()
            ->keyBy('commercial_id');

        $ranking = $commercials
            ->map(function (Commercial $c) use ($invoices, $payments, $commissions, $points, $prospects) {
                $converted = (int) ($invoices[$c->id]->clients_converted ?? 0);
                $prospectsCount = (int) ($prospects[$c->id]->prospects_count ?? 0);

                return [
                    'id' => $c->id,
                    'first_name' => $c->first_name,
                    'last_name' => $c->last_name,
                    'email' => $c->email,
                    'kind' => $c->kind,
                    'agency_id' => $c->agency_id,
                    'agency_name' => $c->agency?->name,
                    'sales_count' => (int) ($invoices[$c->id]->sales_count ?? 0),
                    'revenue_billed' => (float) ($invoices[$c->id]->revenue_billed ?? 0),
                    'revenue_received' => (float) ($payments[$c->id]->revenue_received ?? 0),
                    'payments_count' => (int) ($payments[$c->id]->payments_count ?? 0),
                    'commissions' => (float) ($commissions[$c->id]->commissions ?? 0),
                    'points' => (int) ($points[$c->id]->points ?? 0),
                    'prospects_count' => $prospectsCount,
                    'clients_converted' => $converted,
                    'conversion_rate' => $converted + $prospectsCount > 0
                        ? round($converted / ($converted + $prospectsCount) * 100, 1)
                        : 0.0,
                ];
            })
            ->sortByDesc(fn (array $row) => [$row['sales_count'], $row['revenue_received']])
            ->values();

        return [
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'totals' => [
                'sales_count' => (int) $ranking->sum('sales_count'),
                'revenue_billed' => round($ranking->sum('revenue_billed'), 2),
                'revenue_received' => round($ranking->sum('revenue_received'), 2),
                'payments_count' => (int) $ranking->sum('payments_count'),
                'commissions' => round($ranking->sum('commissions'), 2),
                'points' => (int) $ranking->sum('points'),
                'prospects_count' => (int) $ranking->sum('prospects_count'),
                'clients_converted' => (int) $ranking->sum('clients_converted'),
            ],
            'ranking' => $ranking,
        ];
    }

    private function emptyTotals(): array
    {
        return [
            'sales_count' => 0,
            'revenue_billed' => 0.0,
            'revenue_received' => 0.0,
            'payments_count' => 0,
            'commissions' => 0.0,
            'points' => 0,
            'prospects_count' => 0,
            'clients_converted' => 0,
        ];
    }
}
