<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\TreasuryAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(
        private readonly CommissionService $commissionService,
        private readonly AccountingService $accountingService,
        private readonly PointsService $pointsService,
        private readonly TreasuryService $treasuryService,
        private readonly ContractService $contractService,
        private readonly TreasuryAccountProvisioner $provisioner,
    ) {}

    public function applyPayment(
        Invoice $invoice,
        float $amount,
        string $method,
        bool $isAdvance,
        string $userId,
        ?string $treasuryAccountId = null,
        \DateTimeInterface|string|null $paidAt = null,
        \DateTimeInterface|string|null $receivedAt = null,
    ): void {
        // Caisse de l'agence clôturée par la caissière : rien n'est encaissé
        // avant sa réouverture (la facture reste en attente).
        app(CashClosingService::class)->assertAgencyOpen($invoice->agency_id);

        // Déterminer le compte de trésorerie
        $account = $this->resolveAccount($treasuryAccountId, $invoice, $method);

        $paidAtValue = $paidAt !== null ? Carbon::parse($paidAt) : now();
        // La date de réception est la référence métier (T1.3, B11) : jour où
        // l'argent est reçu (date de la preuve pour une validation différée). À
        // défaut elle vaut la date de règlement.
        $receivedAtValue = $receivedAt !== null ? Carbon::parse($receivedAt) : $paidAtValue;
        abort_if($receivedAtValue->isFuture(), 422, 'La date de réception du paiement ne peut pas être dans le futur.');

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
            'treasury_account_id' => $account->id,
        ]));

        $invoice->increment('amount_paid', $amount);
        $invoice->refreshStatus();
        $invoice->save();

        // Mouvement de trésorerie in, daté du jour de réception de l'argent.
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
            transactedAt: $payment->received_at,
        );

        $this->commissionService->recordForPayment($invoice, $payment, $userId);
        $this->accountingService->recordIncomeFromPayment($invoice, $payment);

        if ($invoice->status === 'paid') {
            $this->pointsService->awardForSale($invoice, $userId);
        }

        // Agency (D10) : le premier paiement active le contrat lié.
        $this->contractService->activateOnFirstPayment($invoice);
    }

    /**
     * Caisse d'un paiement (T1.4 / T2.5) — jamais nulle.
     *
     * Le mode de paiement détermine la caisse (cahier §2 : « le montant va dans
     * la bonne caisse, sans qu'ils en voient le solde ») : espèces → C, Orange
     * Money → O, MTN MoMo → M, Wave → W, Moov → V, banque → B. Si la caisse
     * standard n'existe pas encore pour l'agence, elle est créée. Plus aucun repli
     * silencieux sur la caisse espèces pour un paiement mobile (constat F3).
     *
     * Un compte explicite reste accepté s'il appartient à l'agence de la facture
     * et correspond au type du mode de paiement.
     */
    private function resolveAccount(?string $accountId, Invoice $invoice, ?string $method = null): TreasuryAccount
    {
        $expectedType = match (RevenueService::normalizeMode($method)) {
            RevenueService::MODE_OM, RevenueService::MODE_MOMO, RevenueService::MODE_MOBILE => TreasuryAccount::TYPE_MOBILE_MONEY,
            RevenueService::MODE_BANK => TreasuryAccount::TYPE_BANK,
            default => TreasuryAccount::TYPE_CASH,
        };

        if ($accountId) {
            $account = TreasuryAccount::where('id', $accountId)->where('is_active', true)->first();
            abort_if(! $account, 422, 'Compte de trésorerie inexistant ou inactif.');
            abort_if(
                $account->agency_id !== $invoice->agency_id,
                422,
                "Le compte de trésorerie sélectionné n'appartient pas à l'agence de la facture."
            );
            abort_if(
                $account->type !== $expectedType,
                422,
                'Le compte de trésorerie sélectionné ne correspond pas au mode de paiement.'
            );

            return $account;
        }

        $agencyAccounts = TreasuryAccount::where('agency_id', $invoice->agency_id)->where('is_active', true);

        // Caisse créée par l'administration : le moyen de paiement EST la caisse.
        if (\App\Support\PaymentMethods::isCustom($method)) {
            $account = (clone $agencyAccounts)->where('method_key', $method)->first();
            abort_if(! $account, 422, "Le moyen de paiement « ".\App\Support\PaymentMethods::label($method)." » n'a pas de caisse dans l'agence de la facture.");

            return $account;
        }

        $code = TreasuryAccountProvisioner::codeForMethod($method);

        if ($code === null) {
            // Mode « mobile » générique : acceptable s'il n'y a qu'une caisse
            // numérique dans l'agence, sinon le mode exact doit être précisé.
            $candidates = (clone $agencyAccounts)->where('type', $expectedType)->get();
            abort_if(
                $candidates->count() !== 1,
                422,
                'Précisez le mode de paiement mobile (Orange Money, MTN MoMo, Wave ou Moov) pour affecter le montant à la bonne caisse.'
            );

            return $candidates->first();
        }

        $account = (clone $agencyAccounts)->where('code', $code)->first();
        if ($account) {
            return $account;
        }

        // Comptes antérieurs à la codification (sans code) : un seul compte du bon
        // type et du bon opérateur est repris tel quel.
        $template = TreasuryAccountProvisioner::TEMPLATES[$code];
        $legacy = (clone $agencyAccounts)
            ->whereNull('code')
            ->where('type', $template['type'])
            ->when($template['provider'] !== null, fn ($q) => $q->where('provider', $template['provider']))
            ->get();
        if ($legacy->count() === 1) {
            return $legacy->first();
        }

        $account = $this->provisioner->ensureAccount($invoice->agency, $code);
        abort_if(! $account->is_active, 422, "La caisse {$code} de l'agence est désactivée : réactivez-la ou choisissez un autre mode de paiement.");

        return $account;
    }
}
