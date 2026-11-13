<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\Agency;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\User;
use App\Services\ExpenseService;
use App\Services\FinancialMetricsService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T3.12 — budget publicitaire client (pass-through).
 *
 * Le budget facturé au client n'est ni du CA ni une dépense : seuls les
 * honoraires comptent. Une dépense payée sur ce budget sort des dépenses
 * d'exploitation et reste rattachée à la facture qui la finance.
 */
class PassThroughBudgetTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $admin;

    private TreasuryAccount $cash;

    private AccountingCategory $expenseCategory;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
        $this->admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);

        $this->cash = TreasuryAccount::create([
            'agency_id' => $this->agency->id,
            'code' => 'C',
            'name' => 'Caisse Principale',
            'type' => TreasuryAccount::TYPE_CASH,
            'opening_balance' => 0,
            'currency_code' => 'XAF',
            'is_active' => true,
        ]);

        $this->expenseCategory = AccountingCategory::create([
            'name' => 'Publicité',
            'type' => 'expense',
            'agency_id' => null,
        ]);
    }

    /** Facture de 100 000 d'honoraires + 500 000 de budget pub, entièrement payée. */
    private function invoiceWithAdBudget(float $fees = 100000, float $budget = 500000): Invoice
    {
        $invoice = Invoice::create([
            'number' => 'PK-PT-'.(++$this->seq),
            'agency_id' => $this->agency->id,
            'invoice_date' => now()->toDateString(),
            'client_name' => 'Client Budget',
            'total_amount' => $fees + $budget,
            'amount_paid' => $fees + $budget,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'paid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ]);

        $invoice->items()->create([
            'label' => 'Frais de gestion de campagne',
            'quantity' => 1,
            'unit_price' => $fees,
            'line_total' => $fees,
            'is_pass_through' => false,
        ]);

        $invoice->items()->create([
            'label' => 'Budget publicitaire client',
            'quantity' => 1,
            'unit_price' => $budget,
            'line_total' => $budget,
            'is_pass_through' => true,
        ]);

        InvoicePayment::create([
            'invoice_id' => $invoice->id,
            'amount' => $fees + $budget,
            'payment_method' => 'cash',
            'paid_at' => now(),
            'received_at' => now(),
            'treasury_account_id' => $this->cash->id,
        ]);

        return $invoice;
    }

    private function metrics(): array
    {
        return app(FinancialMetricsService::class)->summary(
            now()->startOfDay(),
            now()->endOfDay(),
            [$this->agency->id],
        );
    }

    private function paidExpense(float $amount, bool $passThrough, ?string $invoiceId = null): Expense
    {
        $expense = Expense::create([
            'number' => Expense::generateNextNumber(),
            'agency_id' => $this->agency->id,
            'category_id' => $this->expenseCategory->id,
            'amount' => $amount,
            'expense_date' => now()->toDateString(),
            'status' => Expense::STATUS_APPROVED,
            'requested_by' => $this->admin->id,
            'is_pass_through' => $passThrough,
            'invoice_id' => $invoiceId,
        ]);

        return app(ExpenseService::class)->pay($expense, $this->cash->id, $this->admin->id);
    }

    public function test_revenue_and_collected_exclude_the_client_ad_budget(): void
    {
        $this->invoiceWithAdBudget(fees: 100000, budget: 500000);

        $metrics = $this->metrics();

        // Seuls les honoraires comptent, à la vente comme à l'encaissement.
        $this->assertSame(100000.0, (float) $metrics['ca']);
        $this->assertSame(100000.0, (float) $metrics['encaisse']);
    }

    public function test_expense_paid_on_the_client_budget_is_not_an_operating_expense(): void
    {
        $invoice = $this->invoiceWithAdBudget();

        $expense = $this->paidExpense(200000, passThrough: true, invoiceId: $invoice->id);

        $this->assertTrue((bool) $expense->fresh()->is_pass_through);
        // L'écriture comptable porte le même drapeau : toutes les synthèses l'ignorent.
        $this->assertDatabaseHas('accounting_transactions', [
            'reference' => $expense->number,
            'is_pass_through' => true,
        ]);

        $metrics = $this->metrics();
        $this->assertSame(0.0, (float) $metrics['depenses']);

        // Une dépense normale, elle, reste une dépense d'exploitation.
        $this->paidExpense(50000, passThrough: false);
        $this->assertSame(50000.0, (float) $this->metrics()['depenses']);
    }

    public function test_ad_budget_expense_requires_an_invoice_carrying_the_budget(): void
    {
        Sanctum::actingAs($this->admin);

        // Aucune facture : le drapeau seul ne suffit pas.
        $this->postJson('/api/expenses', [
            'agency_id' => $this->agency->id,
            'category_id' => $this->expenseCategory->id,
            'amount' => 20000,
            'expense_date' => now()->toDateString(),
            'is_pass_through' => true,
        ])->assertStatus(422);

        // Facture sans ligne de budget publicitaire.
        $plain = Invoice::create([
            'number' => 'PK-PT-PLAIN',
            'agency_id' => $this->agency->id,
            'invoice_date' => now()->toDateString(),
            'client_name' => 'Client Simple',
            'total_amount' => 30000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);
        $plain->items()->create(['label' => 'Prestation', 'quantity' => 1, 'unit_price' => 30000, 'line_total' => 30000]);

        $this->postJson('/api/expenses', [
            'agency_id' => $this->agency->id,
            'category_id' => $this->expenseCategory->id,
            'amount' => 20000,
            'expense_date' => now()->toDateString(),
            'invoice_id' => $plain->id,
        ])->assertStatus(422);

        // Facture portant du budget pub : acceptée et marquée automatiquement.
        $budgeted = $this->invoiceWithAdBudget();
        $this->postJson('/api/expenses', [
            'agency_id' => $this->agency->id,
            'category_id' => $this->expenseCategory->id,
            'amount' => 20000,
            'expense_date' => now()->toDateString(),
            'invoice_id' => $budgeted->id,
        ])->assertCreated()
            ->assertJsonPath('is_pass_through', true);
    }
}
