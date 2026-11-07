<?php

namespace App\Services;

use App\Models\AccountingTransaction;
use App\Models\CommissionEntry;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Facades\DB;

/**
 * Annulation d'une facture : « ses paiements sont alors annulés partout, avec
 * une trace » (cahier, section 1). Rien n'est supprimé :
 *  - chaque paiement est marqué annulé (invoice_payments.cancelled_at) ;
 *  - une écriture de contre-passation (montant négatif, datée du jour de
 *    l'annulation) neutralise sa recette en Comptabilité ;
 *  - l'argent ressort de la caisse où il était entré (mouvement « out » daté du
 *    jour de l'annulation), pour que le solde de caisse reste juste ;
 *  - les commissions non encore versées passent « annulées ».
 *
 * Idempotent : un paiement déjà annulé n'est pas contre-passé deux fois.
 */
class InvoiceCancellationService
{
    public function __construct(private readonly AccountingService $accounting) {}

    /**
     * @return array{payments: int, amount: float, commissions: int, paid_commissions: int}
     */
    public function reverseFinancials(Invoice $invoice, ?string $operatorId = null): array
    {
        return DB::transaction(function () use ($invoice, $operatorId) {
            $payments = InvoicePayment::where('invoice_id', $invoice->id)
                ->whereNull('cancelled_at')
                ->lockForUpdate()
                ->get();

            $now = now();
            $amount = 0.0;

            foreach ($payments as $payment) {
                $payment->update(['cancelled_at' => $now]);
                $amount += (float) $payment->amount;

                $this->reverseTreasuryMovement($payment, $invoice, $operatorId, $now);

                // Contre-passation de la recette (seulement si la recette a été journalisée).
                $income = AccountingTransaction::where('invoice_id', $invoice->id)
                    ->where('type', 'income')
                    ->where('amount', '>', 0)
                    ->exists();

                if ($income) {
                    AccountingTransaction::create([
                        'number' => $this->accounting->nextNumber(),
                        'agency_id' => $invoice->agency_id,
                        'category_id' => $this->accounting->systemCategory('income')?->id,
                        'type' => 'income',
                        'label' => "Facture {$invoice->number} — annulation du versement",
                        'reference' => $invoice->number.'-ANNUL',
                        'amount' => -1 * (float) $payment->amount,
                        'client_id' => $invoice->client_id,
                        'invoice_id' => $invoice->id,
                        'transacted_at' => $now,
                        'operator_id' => $operatorId,
                        'note' => 'Contre-passation automatique (facture annulée)',
                    ]);
                }
            }

            $commissions = CommissionEntry::where('invoice_id', $invoice->id)
                ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
                ->update(['status' => CommissionEntry::STATUS_CANCELLED]);

            // Commissions déjà versées : à régulariser à la main (signalées, pas modifiées).
            $paidCommissions = CommissionEntry::where('invoice_id', $invoice->id)
                ->where('status', CommissionEntry::STATUS_PAID)
                ->count();

            return [
                'payments' => $payments->count(),
                'amount' => $amount,
                'commissions' => $commissions,
                'paid_commissions' => $paidCommissions,
            ];
        });
    }

    /**
     * Sortie de caisse compensant l'encaissement d'un paiement annulé. Écrite
     * directement (pas via TreasuryService) pour fonctionner même si la caisse a
     * été désactivée depuis ; jamais deux fois pour le même paiement.
     */
    private function reverseTreasuryMovement(InvoicePayment $payment, Invoice $invoice, ?string $operatorId, $now): void
    {
        $movement = TreasuryTransaction::where('source_type', 'invoice_payment')
            ->where('source_id', $payment->id)
            ->where('direction', TreasuryTransaction::DIRECTION_IN)
            ->first();

        if (! $movement) {
            return;
        }

        $alreadyReversed = TreasuryTransaction::where('source_type', 'invoice_payment_cancel')
            ->where('source_id', $payment->id)
            ->exists();

        if ($alreadyReversed) {
            return;
        }

        TreasuryTransaction::create([
            'treasury_account_id' => $movement->treasury_account_id,
            'direction' => TreasuryTransaction::DIRECTION_OUT,
            'amount' => $movement->amount,
            'source_type' => 'invoice_payment_cancel',
            'source_id' => $payment->id,
            'category' => 'annulation',
            'label' => "Annulation du paiement — facture {$invoice->number}",
            'reference' => $invoice->number.'-ANNUL',
            'transacted_at' => $now,
            'created_by' => $operatorId,
        ]);
    }
}
