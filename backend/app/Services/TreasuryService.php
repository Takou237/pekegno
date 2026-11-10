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
        ?string $transferType = null,
        ?string $reference = null,
        ?string $createdBy = null,
        \DateTimeInterface|string|null $transactedAt = null,
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
            'transfer_type' => $transferType,
            'label' => $label ?? ($direction === 'in' ? 'Encaissement' : 'Décaissement'),
            'reference' => $reference,
            // Date de l'opération : pour un encaissement, le jour où l'argent est
            // reçu (B11), pas celui de sa validation. À défaut : maintenant.
            'transacted_at' => $transactedAt ?? now(),
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
        string $transferType = 'internal',
    ): array {
        abort_if($amount <= 0, 422, 'Le montant du transfert doit être supérieur à 0.');
        abort_if(! $from->is_active, 422, 'Le compte source est inactif.');
        abort_if(! $to->is_active, 422, 'Le compte destination est inactif.');
        abort_if($from->id === $to->id, 422, 'Les comptes source et destination doivent être différents.');
        abort_if(! in_array($transferType, TreasuryTransaction::TRANSFER_TYPES, true), 422, 'Type de transfert invalide.');
        $this->assertTransferRoute($from, $to, $transferType);

        $transferRef = 'XFER-' . strtoupper(uniqid());

        return DB::transaction(function () use ($from, $to, $amount, $label, $createdBy, $transferRef, $transferType) {
            $out = $this->recordMovement(
                account: $from,
                direction: TreasuryTransaction::DIRECTION_OUT,
                amount: $amount,
                label: $label ?? "Transfert vers {$to->name}",
                sourceType: 'transfer',
                sourceId: $transferRef,
                category: 'transfert',
                transferType: $transferType,
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
                transferType: $transferType,
                reference: $transferRef,
                createdBy: $createdBy,
            );

            return ['out' => $out, 'in' => $in, 'reference' => $transferRef];
        });
    }

    /**
     * Sens autorisé pour chaque type de transfert (cahier §2) :
     * - versement en banque : espèces (C) ou mobile money (O, M, W, V) → banque (B) ;
     * - retrait : mobile money (O, M, W, V) → espèces (C) ;
     * - décaissement administratif : espèces (C) → caisse de l'administration ;
     * - transfert interne : toute caisse vers une autre.
     *
     * @var array<string, array{from: array<int, string>, to: array<int, string>|null, message: string}>
     */
    public const TRANSFER_ROUTES = [
        'bank_deposit' => [
            'from' => ['cash', 'mobile_money'],
            'to' => ['bank'],
            'message' => 'Un versement en banque part des espèces (C) ou du mobile money (O, M, W, V) vers une caisse banque (B).',
        ],
        'withdrawal' => [
            'from' => ['mobile_money'],
            'to' => ['cash'],
            'message' => 'Un retrait part du mobile money (O, M, W, V) vers la caisse espèces (C).',
        ],
        'admin_disbursement' => [
            'from' => ['cash'],
            'to' => null,
            'message' => 'Un décaissement administratif part de la caisse espèces (C).',
        ],
    ];

    private function assertTransferRoute(TreasuryAccount $from, TreasuryAccount $to, string $transferType): void
    {
        $route = self::TRANSFER_ROUTES[$transferType] ?? null;
        if ($route === null) {
            return;
        }

        abort_if(
            ! in_array($from->type, $route['from'], true) || ($route['to'] !== null && ! in_array($to->type, $route['to'], true)),
            422,
            $route['message']
        );
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
