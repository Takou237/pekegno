<?php

namespace Database\Seeders;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Service;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\AccountingService;
use App\Services\CommissionService;
use App\Services\TreasuryService;
use Illuminate\Database\Seeder;

/**
 * Rejoue, pour les donnees de demo deja en base (factures/paiements/depenses
 * crees directement par les seeders de test), les effets de bord normalement
 * produits par PaymentService::applyPayment() / ExpenseService::pay() :
 * - accounting_transactions (page Comptabilite)
 * - treasury_transactions (Bilan du jour, solde des comptes)
 * - commission_entries (page Commissions)
 *
 * Ajoute aussi une vente + une depense datees d'AUJOURD'HUI pour que le
 * "Bilan du jour" ne soit pas vide (il ne regarde que le jour courant).
 *
 * Idempotent : relancable sans creer de doublons.
 */
class BackfillFinancialsSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedTodaySale();

        $accounting = app(AccountingService::class);
        $treasury = app(TreasuryService::class);
        $commission = app(CommissionService::class);

        $this->backfillPayments($accounting, $treasury, $commission);
        $this->backfillPaidExpenses($accounting, $treasury);

        $this->command?->info('Backfill comptabilité / trésorerie / commissions terminé.');
    }

    private function resolveCashAccount(string $agencyId): ?TreasuryAccount
    {
        return TreasuryAccount::where('agency_id', $agencyId)
            ->where('type', 'cash')
            ->where('is_active', true)
            ->first();
    }

    private function backfillPayments(AccountingService $accounting, TreasuryService $treasury, CommissionService $commission): void
    {
        InvoicePayment::with('invoice')->get()->each(function (InvoicePayment $payment) use ($accounting, $treasury, $commission) {
            $invoice = $payment->invoice;

            if (! $invoice || $invoice->validation_status !== Invoice::VALIDATION_VALIDATED) {
                return;
            }

            $account = $payment->treasury_account_id
                ? TreasuryAccount::find($payment->treasury_account_id)
                : $this->resolveCashAccount($invoice->agency_id);

            if ($account && ! $payment->treasury_account_id) {
                $payment->update(['treasury_account_id' => $account->id]);
            }

            if ($account && ! TreasuryTransaction::where('source_type', 'invoice_payment')->where('source_id', $payment->id)->exists()) {
                $treasury->recordMovement(
                    account: $account,
                    direction: 'in',
                    amount: (float) $payment->amount,
                    label: "Paiement facture {$invoice->number}",
                    sourceType: 'invoice_payment',
                    sourceId: $payment->id,
                    category: 'vente',
                    reference: $invoice->number,
                    createdBy: $payment->received_by,
                );
            }

            $commission->recordForPayment($invoice, $payment, $payment->received_by);
            $accounting->recordIncomeFromPayment($invoice, $payment);
        });
    }

    private function backfillPaidExpenses(AccountingService $accounting, TreasuryService $treasury): void
    {
        Expense::where('status', 'paid')->get()->each(function (Expense $expense) use ($accounting, $treasury) {
            if (AccountingTransaction::where('reference', $expense->number)->where('type', 'expense')->exists()) {
                return;
            }

            $account = $expense->treasury_account_id
                ? TreasuryAccount::find($expense->treasury_account_id)
                : $this->resolveCashAccount($expense->agency_id);

            if (! $account) {
                return;
            }

            $treasury->recordMovement(
                account: $account,
                direction: 'out',
                amount: (float) $expense->amount,
                label: "Dépense {$expense->number}",
                sourceType: 'expense',
                sourceId: $expense->id,
                category: $expense->category?->name ?: 'depense',
                reference: $expense->number,
                createdBy: $expense->paid_by,
            );

            AccountingTransaction::create([
                'number' => $accounting->nextNumber(),
                'agency_id' => $expense->agency_id,
                'category_id' => $expense->category_id,
                'type' => 'expense',
                'label' => "Dépense {$expense->number} — {$expense->category?->name}",
                'reference' => $expense->number,
                'amount' => (float) $expense->amount,
                'transacted_at' => $expense->paid_at ?? now(),
                'operator_id' => $expense->paid_by,
                'beneficiary' => $account->name,
            ]);
        });
    }

    /**
     * Une vente + un paiement datés d'aujourd'hui, pour que le Bilan du jour
     * (qui ne regarde que la date du jour) ne soit pas vide.
     */
    private function seedTodaySale(): void
    {
        $douala = Agency::where('name', 'Agence Principale Douala')->first();
        $client = User::where('email', 'claire.client@test.com')->first();
        $commercial = Commercial::where('email', 'fatima.bello@pekegno.com')->first();
        $caissier = User::where('email', 'youssef.hamid@pekegno.com')->first();
        $service = Service::where('name', 'Conseil en organisation')->first();

        if (! $douala || ! $client || ! $commercial || ! $caissier || ! $service) {
            return;
        }

        $invoice = Invoice::firstOrCreate(
            ['number' => 'FAC-TEST-0009'],
            [
                'agency_id' => $douala->id,
                'client_id' => $client->id,
                'client_name' => trim("{$client->first_name} {$client->last_name}"),
                'commercial_id' => $commercial->id,
                'seller_user_id' => $commercial->user_id,
                'invoice_date' => now(),
                'payment_type' => 'cash',
                'total_amount' => $service->price,
                'amount_paid' => $service->price,
                'discount' => 0,
                'vat_rate' => 0,
                'status' => 'paid',
                'validation_status' => Invoice::VALIDATION_VALIDATED,
                'validated_by' => $caissier->id,
                'validated_at' => now(),
                'source' => 'in_person',
                'commission_amount' => round($commercial->commissionFor($service->price), 2),
                'points_awarded' => 30,
                'comment' => 'Vente du jour (démo Bilan)',
            ]
        );

        if (! $invoice->wasRecentlyCreated) {
            return;
        }

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'service_id' => $service->id,
            'label' => $service->name,
            'unit_price' => $service->price,
            'quantity' => 1,
            'line_total' => $service->price,
        ]);

        InvoicePayment::create([
            'invoice_id' => $invoice->id,
            'amount' => $service->price,
            'payment_method' => 'cash',
            'is_advance' => false,
            'paid_at' => now(),
            'received_by' => $caissier->id,
            'comment' => 'Paiement du jour',
        ]);

        $expenseCategory = \App\Models\AccountingCategory::where('type', 'expense')->first();
        $account = $this->resolveCashAccount($douala->id);

        if ($expenseCategory && $account) {
            Expense::firstOrCreate(
                ['number' => 'EXP-TEST-0008'],
                [
                    'agency_id' => $douala->id,
                    'category_id' => $expenseCategory->id,
                    'amount' => 15000,
                    'expense_date' => now()->toDateString(),
                    'status' => 'paid',
                    'treasury_account_id' => $account->id,
                    'requested_by' => $caissier->id,
                    'approved_by' => $caissier->id,
                    'paid_by' => $caissier->id,
                    'paid_at' => now(),
                ]
            );
        }
    }
}
