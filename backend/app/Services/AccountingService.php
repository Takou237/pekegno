<?php

namespace App\Services;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\TreasuryTransaction;
use App\Support\SaleBranch;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    public function __construct(private readonly DepartmentLedger $ledger) {}

    /**
     * Journalise l'entrée d'argent d'un encaissement (toute entrée réelle est tracée).
     * Idempotent : une seule écriture par paiement.
     */
    public function recordIncomeFromPayment(Invoice $invoice, InvoicePayment $payment): ?AccountingTransaction
    {
        if (($invoice->validation_status ?? Invoice::VALIDATION_VALIDATED) !== Invoice::VALIDATION_VALIDATED) {
            return null;
        }

        // Anti-doublon (ré-exécution du backfill) : on ne crée l'écriture que s'il
        // y a moins d'écritures de ce montant que de versements de ce montant sur
        // la facture. L'ancien test « une écriture de ce montant existe déjà »
        // ignorait le 2e versement d'un montant identique (ex. 100 000 + 100 000).
        $existing = AccountingTransaction::where('invoice_id', $invoice->id)
            ->where('type', 'income')
            ->where('reference', $invoice->number)
            ->where('amount', (float) $payment->amount)
            ->count();

        $paymentsOfSameAmount = InvoicePayment::where('invoice_id', $invoice->id)
            ->where('amount', (float) $payment->amount)
            ->count();

        if ($existing >= max(1, $paymentsOfSameAmount)) {
            return null;
        }

        return AccountingTransaction::create([
            'number' => $this->nextNumber(),
            'agency_id' => $invoice->agency_id,
            'department_id' => $this->ledger->departmentForInvoice($invoice),
            'category_id' => $this->incomeCategoryId($invoice),
            'type' => 'income',
            'label' => "Facture {$invoice->number} — versement",
            'reference' => $invoice->number,
            'amount' => (float) $payment->amount,
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'transacted_at' => $payment->received_at ?? $payment->paid_at ?? now(),
            'operator_id' => $payment->received_by,
        ]);
    }

    /**
     * Rubrique d'une facture (cahier B4 : chaque paiement reprend la catégorie
     * de la ligne de facture) : celle de ses lignes qui pèse le plus, selon la
     * règle unique SaleBranch (Academy, Agency, Séminaire, Livre, Canva…).
     * Une facture qui mélange plusieurs rubriques prend la principale ; la
     * répartition exacte est dans « Recettes par rubrique ».
     */
    public function incomeRubric(Invoice $invoice): string
    {
        $lines = DB::table('invoice_items')->where('invoice_items.invoice_id', $invoice->id);
        $category = SaleBranch::categorySql();

        $rubric = SaleBranch::joinCatalog(clone $lines)
            ->where(fn ($q) => $q->whereNull('invoice_items.is_pass_through')->orWhere('invoice_items.is_pass_through', false))
            ->selectRaw("{$category} as rubric")
            ->groupByRaw($category)
            ->orderByRaw('sum(invoice_items.line_total) desc')
            ->orderByRaw($category)
            ->value('rubric');

        if ($rubric !== null) {
            return $rubric;
        }

        return (clone $lines)->where('invoice_items.is_pass_through', true)->exists()
            ? SaleBranch::PASS_THROUGH
            : SaleBranch::UNCATEGORIZED;
    }

    /** Catégorie comptable (recette) portant le nom de la rubrique, créée au besoin. */
    public function incomeCategoryId(Invoice $invoice): string
    {
        return AccountingCategory::firstOrCreate(
            ['name' => $this->incomeRubric($invoice), 'type' => 'income', 'agency_id' => null],
            ['is_system' => false],
        )->id;
    }

    public function systemCategory(string $type): ?AccountingCategory
    {
        return AccountingCategory::query()
            ->where('is_system', true)
            ->where('type', $type)
            ->whereNull('agency_id')
            ->first();
    }

    /**
     * Catégorie système dédiée aux commissions (créée au besoin pour les
     * bases existantes qui ne l'ont pas encore).
     */
    public function commissionExpenseCategory(): AccountingCategory
    {
        return AccountingCategory::firstOrCreate(
            ['name' => 'Commissions', 'type' => 'expense', 'agency_id' => null, 'is_system' => true],
            ['name' => 'Commissions', 'type' => 'expense', 'agency_id' => null, 'is_system' => true],
        );
    }

    public function nextNumber(): int
    {
        return ((int) AccountingTransaction::max('number')) + 1;
    }

    /**
     * T1.4 — mouvement de caisse d'une écriture saisie à la main en Comptabilité.
     *
     * Une dépense manuelle sort de sa caisse (out), une recette manuelle avec
     * caisse y entre (in). Le mouvement suit l'écriture : créé, mis à jour
     * (montant, date, caisse, sens) ou supprimé avec elle. Les écritures
     * automatiques (paiements, dépenses du circuit) ont leur propre mouvement.
     */
    public function syncManualTreasuryMovement(AccountingTransaction $transaction, bool $deleted = false): void
    {
        $movement = TreasuryTransaction::where('source_type', 'accounting_transaction')
            ->where('source_id', $transaction->id)
            ->first();

        if ($deleted || $transaction->treasury_account_id === null) {
            $movement?->delete();

            return;
        }

        $attributes = [
            'treasury_account_id' => $transaction->treasury_account_id,
            'direction' => $transaction->type === 'expense' ? TreasuryTransaction::DIRECTION_OUT : TreasuryTransaction::DIRECTION_IN,
            'amount' => $transaction->amount,
            'category' => $transaction->category?->name ?? ($transaction->type === 'expense' ? 'depense' : 'recette'),
            'label' => $transaction->label,
            'reference' => 'CPT-'.$transaction->number,
            'transacted_at' => $transaction->transacted_at ?? now(),
        ];

        if ($movement) {
            $movement->update($attributes);

            return;
        }

        TreasuryTransaction::create($attributes + [
            'source_type' => 'accounting_transaction',
            'source_id' => $transaction->id,
            'created_by' => $transaction->operator_id,
        ]);
    }
}
