<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\TreasuryAccount;

class PaymentService
{
    public function __construct(
        private readonly CommissionService $commissionService,
        private readonly AccountingService $accountingService,
        private readonly PointsService $pointsService,
        private readonly TreasuryService $treasuryService,
    ) {}

    public function applyPayment(
        Invoice $invoice,
        float $amount,
        string $method,
        bool $isAdvance,
        string $userId,
        ?string $treasuryAccountId = null,
    ): void {
        abort_if($invoice->payments()->count() >= 3, 422, 'Paiement en tranches limité à 3 (3 versements maximum).');

        // Déterminer le compte de trésorerie
        $account = $this->resolveAccount($treasuryAccountId, $invoice);

        $payment = $invoice->payments()->create([
            'amount' => $amount,
            'payment_method' => $method,
            'is_advance' => $isAdvance,
            'paid_at' => now(),
            'received_by' => $userId,
            'treasury_account_id' => $account?->id,
        ]);

        $invoice->increment('amount_paid', $amount);
        $invoice->refreshStatus();
        $invoice->save();

        // Mouvement de trésorerie in
        if ($account) {
            $this->treasuryService->recordMovement(
                account: $account,
                direction: 'in',
                amount: $amount,
                label: "Paiement facture {$invoice->number}",
                sourceType: 'invoice_payment',
                sourceId: $payment->id,
                category: 'vente',
                reference: $invoice->number,
                createdBy: $userId,
            );
        }

        $this->commissionService->recordForPayment($invoice, $payment, $userId);
        $this->accountingService->recordIncomeFromPayment($invoice, $payment);

        if ($invoice->status === 'paid') {
            $this->pointsService->awardForSale($invoice, $userId);
        }
    }

    /**
     * Déterminer le compte de trésorerie à utiliser.
     */
    private function resolveAccount(?string $accountId, Invoice $invoice): ?TreasuryAccount
    {
        if ($accountId) {
            $account = TreasuryAccount::where('id', $accountId)->where('is_active', true)->first();
            abort_if(! $account, 422, 'Compte de trésorerie inexistant ou inactif.');

            return $account;
        }

        // Fallback: compte cash de l'agence de la facture
        return TreasuryAccount::where('agency_id', $invoice->agency_id)
            ->where('type', 'cash')
            ->where('is_active', true)
            ->first();
    }
}
