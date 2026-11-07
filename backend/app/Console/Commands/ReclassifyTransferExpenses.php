<?php

namespace App\Console\Commands;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryAccountProvisioner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rattrapage B13 / T2.7 : un versement en banque (ou un décaissement vers
 * l'administration) saisi comme dépense est un transfert entre caisses.
 *
 * Repère les écritures de dépense dont la catégorie ou le libellé évoque un
 * versement / transfert (ex. « VERSEMENT BANCAIRE — Versement à Afriland »,
 * 222 000 à Yaoundé le 02/11). Simulation par défaut : la liste est à relire.
 * Avec --apply, chaque écriture retenue :
 *  - est marquée `is_transfer` (elle sort des dépenses partout, reste visible) ;
 *  - devient un transfert C → B (bank_deposit) daté de l'écriture, sauf si la
 *    caisse a déjà un mouvement pour elle.
 * --id=… restreint aux écritures choisies (numéro ou uuid). Rejouable.
 */
class ReclassifyTransferExpenses extends Command
{
    protected $signature = 'treasury:reclassify-transfers
        {--apply : Écrire les corrections (sinon simulation)}
        {--id=* : Ne traiter que ces écritures (numéro ou uuid)}';

    protected $description = 'Reclasse en transferts les versements en banque saisis comme dépenses';

    public function handle(TreasuryAccountProvisioner $provisioner): int
    {
        $apply = (bool) $this->option('apply');
        $ids = (array) $this->option('id');

        $candidates = AccountingTransaction::with(['category', 'agency'])
            ->where('type', 'expense')
            ->where('is_transfer', false)
            ->whereNull('invoice_id')
            ->when($ids !== [], fn ($q) => $q->where(function ($q) use ($ids) {
                $numbers = array_values(array_filter($ids, 'ctype_digit'));
                $q->whereIn('id', $ids)->when($numbers !== [], fn ($q) => $q->orWhereIn('number', $numbers));
            }))
            ->orderBy('transacted_at')
            ->get()
            ->filter(fn (AccountingTransaction $t) => $ids !== [] || AccountingTransaction::looksLikeTransfer($t->category?->name, $t->label));

        $rows = [];
        $total = 0.0;

        foreach ($candidates as $transaction) {
            $total += (float) $transaction->amount;
            $rows[] = [
                $transaction->number,
                $transaction->transacted_at?->format('d/m/Y'),
                $transaction->agency?->name ?? '—',
                $transaction->category?->name ?? '—',
                mb_strimwidth((string) $transaction->label, 0, 40, '…'),
                number_format((float) $transaction->amount, 0, ',', ' '),
            ];

            if ($apply) {
                $this->reclassify($transaction, $provisioner);
            }
        }

        $this->table(['N°', 'Date', 'Agence', 'Catégorie', 'Libellé', 'Montant'], $rows);
        $this->info(sprintf(
            '%d écriture(s), %s %s en transferts%s.',
            count($rows),
            number_format($total, 0, ',', ' '),
            $apply ? 'reclassés' : 'à reclasser',
            $apply ? '' : ' (SIMULATION — relire la liste, puis --apply, éventuellement avec --id=…)'
        ));

        return self::SUCCESS;
    }

    private function reclassify(AccountingTransaction $transaction, TreasuryAccountProvisioner $provisioner): void
    {
        DB::transaction(function () use ($transaction, $provisioner) {
            $transaction->update(['is_transfer' => true]);

            $agency = $transaction->agency_id ? Agency::find($transaction->agency_id) : null;
            if (! $agency) {
                return;
            }

            $reference = 'RECLASS-'.$transaction->number;
            if (TreasuryTransaction::where('reference', $reference)->exists()) {
                return;
            }

            // Une dépense manuelle déjà sortie d'une caisse : on garde cette sortie
            // comme jambe « out » du transfert et on ajoute seulement l'entrée en B.
            $existingOut = TreasuryTransaction::where('source_type', 'accounting_transaction')
                ->where('source_id', $transaction->id)
                ->first();

            $from = $existingOut?->account ?? $provisioner->ensureAccount($agency, 'C');
            $to = $provisioner->ensureAccount($agency, 'B');

            $common = [
                'amount' => $transaction->amount,
                'source_type' => 'transfer',
                'source_id' => $reference,
                'category' => 'transfert',
                'transfer_type' => 'bank_deposit',
                'label' => $transaction->label.' (reclassé en transfert)',
                'reference' => $reference,
                'transacted_at' => $transaction->transacted_at,
                'created_by' => $transaction->operator_id,
            ];

            if ($existingOut) {
                $existingOut->update(['source_type' => 'transfer', 'source_id' => $reference, 'transfer_type' => 'bank_deposit', 'reference' => $reference]);
            } else {
                TreasuryTransaction::create($common + ['treasury_account_id' => $from->id, 'direction' => TreasuryTransaction::DIRECTION_OUT]);
            }

            TreasuryTransaction::create($common + ['treasury_account_id' => $to->id, 'direction' => TreasuryTransaction::DIRECTION_IN]);
        });
    }
}
