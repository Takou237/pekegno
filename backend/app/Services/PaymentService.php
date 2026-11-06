<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\TreasuryAccount;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(
        private readonly CommissionService $commissionService,
        private readonly AccountingService $accountingService,
        private readonly PointsService $pointsService,
        private readonly TreasuryService $treasuryService,
        private readonly ContractService $contractService,
    ) {}

    public function applyPayment(
        Invoice $invoice,
        float $amount,
        string $method,
        bool $isAdvance,
        string $userId,
        ?string $treasuryAccountId = null,
        ?string $paidAt = null,
        ?string $receivedAt = null,
    ): void {
        // Déterminer le compte de trésorerie
        $account = $this->resolveAccount($treasuryAccountId, $invoice, $method);

        $paidAtValue = $paidAt ?? now();
        // La date de réception est la référence métier (T1.3) ; à défaut elle
        // vaut la date de règlement (données historiques et saisies directes).
        $receivedAtValue = $receivedAt ?? $paidAtValue;

        // Transaction : le verrou du numéro de reçu reste tenu jusqu'à l'insertion.
        $payment = DB::transaction(fn () => $invoice->payments()->create([
            'amount' => $amount,
            'payment_method' => $method,
            'is_advance' => $isAdvance,
            'paid_at' => $paidAtValue,
            'received_at' => $receivedAtValue,
            'validated_at' => now(),
            'validation_status' => 'validated',
            'received_by' => $userId,
            'treasury_account_id' => $account?->id,
        ]));

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

        // Agency (D10) : le premier paiement active le contrat lié.
        $this->contractService->activateOnFirstPayment($invoice);
    }

    /**
     * Déterminer le compte de trésorerie à utiliser.
     *
     * Le compte explicite est obligatoire dès que l'agence en possède un ; à
     * défaut on résout un compte cohérent avec le mode de paiement (caisse C /
     * mobile money O-M / banque B), puis la caisse cash de l'agence. Il ne doit
     * jamais y avoir de repli silencieux sur une caisse sans rapport avec le
     * mode de paiement (constat F3).
     */
    private function resolveAccount(?string $accountId, Invoice $invoice, ?string $method = null): ?TreasuryAccount
    {
        if ($accountId) {
            $account = TreasuryAccount::where('id', $accountId)->where('is_active', true)->first();
            abort_if(! $account, 422, 'Compte de trésorerie inexistant ou inactif.');
            abort_if(
                $account->agency_id !== null && $invoice->agency_id !== null && $account->agency_id !== $invoice->agency_id,
                422,
                "Le compte de trésorerie sélectionné n'appartient pas à l'agence de la facture."
            );

            return $account;
        }

        $agencyAccounts = TreasuryAccount::where('agency_id', $invoice->agency_id)->where('is_active', true);

        // Le mode de paiement détermine le type de compte attendu.
        $type = match (RevenueService::normalizeMode($method)) {
            RevenueService::MODE_OM, RevenueService::MODE_MOMO, RevenueService::MODE_MOBILE => 'mobile_money',
            RevenueService::MODE_BANK => 'bank',
            default => 'cash',
        };

        // S'il existe plusieurs comptes de ce type, l'utilisateur doit choisir.
        $candidates = (clone $agencyAccounts)->where('type', $type)->get();
        if ($candidates->count() === 1) {
            return $candidates->first();
        }

        if ($candidates->count() > 1) {
            abort(422, 'Plusieurs comptes de trésorerie correspondent à ce mode de paiement : précisez treasury_account_id.');
        }

        // Dernier recours : la caisse cash de l'agence.
        return (clone $agencyAccounts)->where('type', 'cash')->first();
    }
}
