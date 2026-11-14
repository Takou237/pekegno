<?php

namespace Tests\Concerns;

use App\Models\AccountingTransaction;
use App\Models\TreasuryAccount;
use App\Services\AccountingService;

/**
 * Sortie déjà payée, avec son écriture et sa sortie de caisse datées.
 *
 * Une sortie ne se saisit plus en écriture directe (elle suit le circuit des
 * dépenses, N25) ; les tests de calcul (Bilan, caisses, cartes) qui ont besoin
 * d'une dépense à une date précise l'enregistrent ainsi.
 */
trait ManualExpense
{
    protected function manualExpense(array $data): AccountingTransaction
    {
        $service = app(AccountingService::class);

        if (empty($data['agency_id']) && ! empty($data['treasury_account_id'])) {
            $data['agency_id'] = TreasuryAccount::whereKey($data['treasury_account_id'])->value('agency_id');
        }

        $transaction = AccountingTransaction::create(array_merge($data, [
            'type' => 'expense',
            'number' => $service->nextNumber(),
            'operator_id' => auth()->id(),
            'transacted_at' => $data['transacted_at'] ?? now(),
        ]));
        $service->syncManualTreasuryMovement($transaction);

        return $transaction;
    }
}
