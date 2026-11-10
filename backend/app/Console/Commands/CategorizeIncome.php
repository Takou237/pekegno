<?php

namespace App\Console\Commands;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Invoice;
use App\Services\AccountingService;
use Illuminate\Console\Command;

/**
 * Rattrapage B4 : les écritures de versement n'avaient pas de catégorie (ou la
 * catégorie générique « Encaissement facture »). Chaque recette liée à une
 * facture reçoit la catégorie de sa rubrique (Academy, Agency, Séminaire,
 * Livre, Canva…), comme les nouveaux versements.
 *
 * Ne touche pas aux recettes saisies à la main ni à une catégorie choisie par
 * un utilisateur. Simulation par défaut ; --apply écrit. Rejouable.
 */
class CategorizeIncome extends Command
{
    protected $signature = 'accounting:categorize-income {--apply : Écrire les corrections (sinon simulation)}';

    protected $description = 'Range chaque recette de facture dans la catégorie de sa rubrique';

    public function handle(AccountingService $accounting): int
    {
        $apply = (bool) $this->option('apply');
        $generic = AccountingCategory::where('type', 'income')->where('is_system', true)->pluck('id')->all();
        $byRubric = [];
        $changed = 0;

        AccountingTransaction::query()
            ->where('type', 'income')
            ->whereNotNull('invoice_id')
            ->where(fn ($q) => $q->whereNull('category_id')->orWhereIn('category_id', $generic))
            ->chunkById(500, function ($transactions) use ($accounting, $apply, &$byRubric, &$changed) {
                $invoices = Invoice::whereIn('id', $transactions->pluck('invoice_id')->unique())->get()->keyBy('id');
                $rubrics = [];

                foreach ($transactions as $transaction) {
                    $invoice = $invoices[$transaction->invoice_id] ?? null;
                    if (! $invoice) {
                        continue;
                    }

                    $rubric = $rubrics[$invoice->id] ??= $accounting->incomeRubric($invoice);
                    $changed++;
                    $byRubric[$rubric] ??= ['count' => 0, 'amount' => 0.0];
                    $byRubric[$rubric]['count']++;
                    $byRubric[$rubric]['amount'] += (float) $transaction->amount;

                    if ($apply) {
                        $transaction->update(['category_id' => $accounting->incomeCategoryId($invoice)]);
                    }
                }
            });

        $this->table(
            ['Rubrique', 'Écritures', 'Montant'],
            collect($byRubric)->sortByDesc('amount')->map(fn ($m, $r) => [$r, $m['count'], number_format($m['amount'], 0, ',', ' ')])->values()->all()
        );
        $this->info(sprintf(
            '%d écriture(s) %s.%s',
            $changed,
            $apply ? 'rangée(s) dans leur rubrique' : 'à ranger',
            $apply ? '' : ' (SIMULATION — relancer avec --apply)'
        ));

        return self::SUCCESS;
    }
}
