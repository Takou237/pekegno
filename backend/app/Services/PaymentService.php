<?php

namespace App\Services;

use App\Models\Invoice;

class PaymentService
{
    public function __construct(
        private readonly CommissionService $commissionService,
        private readonly AccountingService $accountingService,
        private readonly PointsService $pointsService,
    ) {}

    public function applyPayment(Invoice $invoice, float $amount, string $method, bool $isAdvance, string $userId): void
    {
        abort_if($invoice->payments()->count() >= 3, 422, 'Paiement en tranches limité à 3 (3 versements maximum).');

        $payment = $invoice->payments()->create([
            'amount' => $amount,
            'payment_method' => $method,
            'is_advance' => $isAdvance,
            'paid_at' => now(),
            'received_by' => $userId,
        ]);

        $invoice->increment('amount_paid', $amount);
        $invoice->refreshStatus();
        $invoice->save();

        $this->commissionService->recordForPayment($invoice, $payment, $userId);
        $this->accountingService->recordIncomeFromPayment($invoice, $payment);

        if ($invoice->status === 'paid') {
            $this->pointsService->awardForSale($invoice, $userId);
        }
    }
}
