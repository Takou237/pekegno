<?php

namespace App\Services;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Invoice;
use App\Models\InvoicePayment;

class AccountingService
{
    /**
     * Journalise l'entrée d'argent d'un encaissement (toute entrée réelle est tracée).
     * Idempotent : une seule écriture par paiement.
     */
    public function recordIncomeFromPayment(Invoice $invoice, InvoicePayment $payment): ?AccountingTransaction
    {
        if (AccountingTransaction::where('invoice_id', $invoice->id)
            ->where('reference', $invoice->number)
            ->where('amount', (float) $payment->amount)
            ->exists()) {
            return null;
        }

        return AccountingTransaction::create([
            'number' => $this->nextNumber(),
            'agency_id' => $invoice->agency_id,
            'category_id' => $this->systemCategory('income')?->id,
            'type' => 'income',
            'label' => "Facture {$invoice->number} — versement",
            'reference' => $invoice->number,
            'amount' => (float) $payment->amount,
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'transacted_at' => $payment->paid_at ?? now(),
            'operator_id' => $payment->received_by,
        ]);
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
}
