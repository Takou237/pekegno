<?php

namespace App\Services;

use App\Models\Invoice;

/**
 * T8.2 : repère une facture probablement saisie deux fois (même client, même
 * montant, à moins de 7 jours). L'alerte est informative : elle ne bloque pas
 * l'enregistrement.
 */
class DuplicateInvoiceDetector
{
    public const WINDOW_DAYS = 7;

    public function find(Invoice $invoice): ?Invoice
    {
        $date = $invoice->invoice_date?->copy() ?? now();

        $query = Invoice::query()
            ->whereKeyNot($invoice->getKey())
            ->whereNull('cancelled_at')
            ->where('total_amount', $invoice->total_amount)
            ->whereDate('invoice_date', '>=', $date->copy()->subDays(self::WINDOW_DAYS - 1)->toDateString())
            ->whereDate('invoice_date', '<=', $date->toDateString());

        if ($invoice->client_id) {
            $query->where('client_id', $invoice->client_id);
        } elseif ($invoice->client_name) {
            $query->whereNull('client_id')
                ->whereRaw('lower(client_name) = ?', [mb_strtolower(trim($invoice->client_name))]);
        } else {
            return null;
        }

        return $query->orderByDesc('invoice_date')->orderByDesc('created_at')->first();
    }

    /**
     * @return array{number: string, invoice_date: string|null, total_amount: float}|null
     */
    public function warning(Invoice $invoice): ?array
    {
        $duplicate = $this->find($invoice);

        if (! $duplicate) {
            return null;
        }

        return [
            'number' => $duplicate->number,
            'invoice_date' => $duplicate->invoice_date?->toDateString(),
            'total_amount' => (float) $duplicate->total_amount,
        ];
    }
}
