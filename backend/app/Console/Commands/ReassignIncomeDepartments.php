<?php

namespace App\Console\Commands;

use App\Models\AccountingTransaction;
use App\Models\Department;
use App\Models\Invoice;
use App\Services\DepartmentLedger;
use Illuminate\Console\Command;

/**
 * Rattrapage du rattachement des recettes aux départements : les ventes
 * directes (ni contrat ni inscription) étaient toutes rangées au département
 * Agency ; elles suivent désormais la catégorie des articles vendus (DepartmentLedger),
 * par exemple les livres et abonnements Canva au Store.
 *
 * Recalcule le département de chaque écriture de recette liée à une facture.
 * Simulation par défaut ; --apply écrit. Rejouable.
 */
class ReassignIncomeDepartments extends Command
{
    protected $signature = 'accounting:reassign-departments {--apply : Écrire les corrections (sinon simulation)}';

    protected $description = 'Recalcule le département des recettes selon la catégorie des articles vendus';

    public function handle(DepartmentLedger $ledger): int
    {
        $apply = (bool) $this->option('apply');
        $departments = Department::withTrashed()->get(['id', 'name', 'type'])->keyBy('id');
        $label = fn (?string $id) => $id ? (($departments[$id]->name ?? '?').' ('.($departments[$id]->type ?? '?').')') : '—';

        $moves = [];
        $changed = 0;

        AccountingTransaction::query()
            ->where('type', 'income')
            ->whereNotNull('invoice_id')
            ->chunkById(500, function ($transactions) use ($ledger, $apply, $label, &$moves, &$changed) {
                $invoices = Invoice::whereIn('id', $transactions->pluck('invoice_id')->unique())->get()->keyBy('id');

                foreach ($transactions as $transaction) {
                    $invoice = $invoices[$transaction->invoice_id] ?? null;
                    if (! $invoice) {
                        continue;
                    }

                    $target = $ledger->departmentForInvoice($invoice);
                    if ($target === $transaction->department_id) {
                        continue;
                    }

                    $changed++;
                    $key = $label($transaction->department_id).' → '.$label($target);
                    $moves[$key] ??= ['count' => 0, 'amount' => 0.0];
                    $moves[$key]['count']++;
                    $moves[$key]['amount'] += (float) $transaction->amount;

                    if ($apply) {
                        $transaction->update(['department_id' => $target]);
                    }
                }
            });

        $this->table(
            ['Changement', 'Écritures', 'Montant'],
            collect($moves)->map(fn ($m, $key) => [$key, $m['count'], number_format($m['amount'], 0, ',', ' ')])->values()->all()
        );
        $this->info(sprintf(
            '%d écriture(s) %s.%s',
            $changed,
            $apply ? 'rattachée(s) à leur département' : 'à rattacher',
            $apply ? '' : ' (SIMULATION — relancer avec --apply)'
        ));

        return self::SUCCESS;
    }
}
