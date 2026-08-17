<?php

namespace App\Services;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\DailyBalance;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BilanService
{
    public function daily(Carbon $date, ?string $agencyId): array
    {
        $services = $this->servicesSold($date, $agencyId);
        $received = $this->receivedTotals($date, $agencyId);

        $cash = (float) ($received['cash'] ?? 0);
        $mobile = (float) ($received['mobile'] ?? 0);
        $totalReceived = $cash + $mobile;

        $expenseTotal = (float) AccountingTransaction::query()
            ->where('type', 'expense')
            ->whereDate('transacted_at', $date)
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->sum('amount');

        $salesTotal = (int) collect($services)->sum('count');
        $opening = $this->openingBalance($date, $agencyId);
        $closing = $totalReceived - $expenseTotal;

        $dailyBalance = $this->storeBalance($date, $agencyId, $opening, $closing);

        $coherenceOk = abs($totalReceived - $salesTotal) < 0.01;

        return [
            'date' => $date->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null,
            'services' => $services,
            'total_services_sold' => $salesTotal,
            'cash_total' => $cash,
            'mobile_total' => $mobile,
            'total_received' => $totalReceived,
            'expense_total' => $expenseTotal,
            'solde_initial' => $opening,
            'solde_final' => $closing,
            'coherence' => [
                'ok' => $coherenceOk,
                'message' => $coherenceOk
                    ? 'Cash + Mobile = total des services vendus.'
                    : 'Écart détecté entre les encaissements (cash + mobile) et le total des services vendus.',
            ],
            'daily_balance' => $dailyBalance,
        ];
    }

    private function servicesSold(Carbon $date, ?string $agencyId): array
    {
        return DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->whereDate('invoices.invoice_date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->selectRaw('coalesce(invoice_items.label, \'\') as label, sum(invoice_items.quantity) as count, sum(invoice_items.line_total) as total')
            ->groupBy('label')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'label' => $row->label,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    private function receivedTotals(Carbon $date, ?string $agencyId): array
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

        $received = $this->receivedTotals($previous, $agencyId);

        return (float) ($received['cash'] ?? 0) + (float) ($received['mobile'] ?? 0);
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
