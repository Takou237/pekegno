<?php

namespace App\Services;

use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Facades\DB;

class TreasuryService
{
    /**
     * Enregistrer un mouvement de trésorerie (in ou out).
     */
    public function recordMovement(
        TreasuryAccount $account,
        string $direction,
        float $amount,
        ?string $label,
        ?string $sourceType = null,
        ?string $sourceId = null,
        ?string $category = null,
        ?string $reference = null,
        ?string $createdBy = null,
    ): TreasuryTransaction {
        abort_if(! in_array($direction, TreasuryTransaction::DIRECTIONS, true), 422, 'Direction invalide.');
        abort_if($amount <= 0, 422, 'Le montant doit être supérieur à 0.');
        abort_if(! $account->is_active, 422, 'Ce compte de trésorerie est inactif.');

        return TreasuryTransaction::create([
            'treasury_account_id' => $account->id,
            'direction' => $direction,
            'amount' => $amount,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'category' => $category,
            'label' => $label ?? ($direction === 'in' ? 'Encaissement' : 'Décaissement'),
            'reference' => $reference,
            'transacted_at' => now(),
            'created_by' => $createdBy,
        ]);
    }

    /**
     * Solde calculé d'un compte.
     */
    public function balanceFor(TreasuryAccount $account): float
    {
        return (float) $account->computed_balance;
    }

    /**
     * Transfert entre 2 comptes = 2 mouvements atomiques (out + in).
     */
    public function transfer(
        TreasuryAccount $from,
        TreasuryAccount $to,
        float $amount,
        ?string $label = null,
        ?string $createdBy = null,
    ): array {
        abort_if($amount <= 0, 422, 'Le montant du transfert doit être supérieur à 0.');
        abort_if(! $from->is_active, 422, 'Le compte source est inactif.');
        abort_if(! $to->is_active, 422, 'Le compte destination est inactif.');
        abort_if($from->id === $to->id, 422, 'Les comptes source et destination doivent être différents.');

        $transferRef = 'XFER-' . strtoupper(uniqid());

        return DB::transaction(function () use ($from, $to, $amount, $label, $createdBy, $transferRef) {
            $out = $this->recordMovement(
                account: $from,
                direction: TreasuryTransaction::DIRECTION_OUT,
                amount: $amount,
                label: $label ?? "Transfert vers {$to->name}",
                sourceType: 'transfer',
                sourceId: $transferRef,
                category: 'transfert',
                reference: $transferRef,
                createdBy: $createdBy,
            );

            $in = $this->recordMovement(
                account: $to,
                direction: TreasuryTransaction::DIRECTION_IN,
                amount: $amount,
                label: $label ?? "Transfert depuis {$from->name}",
                sourceType: 'transfer',
                sourceId: $transferRef,
                category: 'transfert',
                reference: $transferRef,
                createdBy: $createdBy,
            );

            return ['out' => $out, 'in' => $in, 'reference' => $transferRef];
        });
    }

    /**
     * Contrepassation d'un mouvement (annulation).
     */
    public function reverse(TreasuryTransaction $transaction, ?string $createdBy = null): TreasuryTransaction
    {
        $reverseDirection = $transaction->direction === TreasuryTransaction::DIRECTION_IN
            ? TreasuryTransaction::DIRECTION_OUT
            : TreasuryTransaction::DIRECTION_IN;

        return $this->recordMovement(
            account: $transaction->account,
            direction: $reverseDirection,
            amount: (float) $transaction->amount,
            label: "Annulation: {$transaction->label}",
            sourceType: 'reversal',
            sourceId: $transaction->id,
            category: 'annulation',
            reference: $transaction->reference,
            createdBy: $createdBy,
        );
    }
}
