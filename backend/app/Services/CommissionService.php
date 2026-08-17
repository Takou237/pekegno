<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\CommissionPayment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use Illuminate\Support\Facades\DB;

class CommissionService
{
    public function __construct(private readonly ActivityLogger $logger) {}

    /**
     * Calcule les commissions versées à l'occasion d'un encaissement (règle multi-lignes).
     *
     * Chaque ligne reçoit une part du paiement proportionnelle à son poids dans la facture.
     * Une ligne dont le service a une prime fixe (bonus_fixed) est calculée à part :
     * prime fixe proratée sur le paiement. Les autres lignes suivent la règle du commercial
     * (percent : % de la part ; fixed : valeur proratée sur la part de la ligne).
     */
    public function calculateForPayment(Invoice $invoice, float $paidAmount, ?Commercial $commercial = null): array
    {
        if ($paidAmount <= 0 || $invoice->commercial_id === null) {
            return [];
        }

        $commercial ??= $invoice->commercial;

        if (! $commercial || $commercial->commission_type === 'none') {
            return [];
        }

        $invoiceTotal = (float) $invoice->total_amount;

        if ($invoiceTotal <= 0) {
            return [];
        }

        $invoice->loadMissing('items.service');

        return $invoice->items
            ->filter(fn (InvoiceItem $line) => (float) $line->line_total > 0)
            ->map(function (InvoiceItem $line) use ($paidAmount, $invoiceTotal, $commercial) {
                $lineShare = round($paidAmount * ((float) $line->line_total / $invoiceTotal), 2);
                $service = $line->service;

                // Prime fixe par service vendu : elle prime sur le pourcentage du commercial.
                if ($service && (float) $service->bonus_fixed > 0) {
                    return [
                        'service_id' => $service->id,
                        'amount' => round((float) $service->bonus_fixed * ($paidAmount / $invoiceTotal), 2),
                        'base_amount' => $lineShare,
                        'rule' => 'service_fixed',
                        'rate' => (float) $service->bonus_fixed,
                    ];
                }

                if ($commercial->commission_type === 'percent') {
                    return [
                        'service_id' => $service?->id,
                        'amount' => round(((float) $commercial->commission_value / 100) * $lineShare, 2),
                        'base_amount' => $lineShare,
                        'rule' => 'percent',
                        'rate' => (float) $commercial->commission_value,
                    ];
                }

                return [
                    'service_id' => $service?->id,
                    'amount' => round((float) $commercial->commission_value * ($lineShare / (float) $line->line_total), 2),
                    'base_amount' => $lineShare,
                    'rule' => 'fixed',
                    'rate' => (float) $commercial->commission_value,
                ];
            })
            ->filter(fn (array $row) => $row['amount'] > 0)
            ->values()
            ->all();
    }

    /**
     * Journalise les commissions d'un encaissement (idempotent par payment_id)
     * et incrémente l'agrégat invoices.commission_amount.
     */
    public function recordForPayment(Invoice $invoice, InvoicePayment $payment, ?string $actorUserId = null): void
    {
        if (CommissionPayment::where('payment_id', $payment->id)->exists()) {
            return;
        }

        $rows = $this->calculateForPayment($invoice, (float) $payment->amount);

        if (empty($rows)) {
            return;
        }

        DB::transaction(function () use ($invoice, $payment, $rows, $actorUserId) {
            $total = 0.0;

            foreach ($rows as $row) {
                $total += $row['amount'];

                CommissionPayment::create(array_merge($row, [
                    'commercial_id' => $invoice->commercial_id,
                    'invoice_id' => $invoice->id,
                    'payment_id' => $payment->id,
                    'invoice_total' => (float) $invoice->total_amount,
                    'created_by' => $actorUserId,
                ]));
            }

            $total = round($total, 2);

            // La colonne peut être NULL (agrégat), un increment SQL sur NULL resterait NULL.
            if ($invoice->commission_amount === null) {
                $invoice->update(['commission_amount' => $total]);
            } else {
                $invoice->increment('commission_amount', $total);
            }

            $this->logger->log(
                action: 'commission',
                entityType: 'invoice',
                entityId: $invoice->id,
                description: "Commission de {$total} FCFA versée sur la facture {$invoice->number} (versement de {$payment->amount} FCFA)",
                newValues: ['payment_id' => $payment->id, 'amount' => $total],
            );
        });
    }
}
