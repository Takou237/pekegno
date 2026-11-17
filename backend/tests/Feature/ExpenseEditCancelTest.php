<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\Expense;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Point 13 : une dépense peut être modifiée avant paiement et annulée.
 * L'annulation d'une dépense payée remet l'argent en caisse et retire
 * l'écriture comptable.
 */
class ExpenseEditCancelTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;
    private AccountingCategory $category;
    private User $actor;
    private int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->agency = Agency::factory()->create();
        $this->category = AccountingCategory::create(['name' => 'Fournitures', 'type' => 'expense']);
        $this->actor = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($this->actor);
    }

    private function account(float $openingBalance = 50000): TreasuryAccount
    {
        return TreasuryAccount::create([
            'agency_id' => $this->agency->id,
            'code' => 'C',
            'name' => 'Caisse espèces',
            'type' => 'cash',
            'opening_balance' => $openingBalance,
            'currency_code' => 'XAF',
            'is_active' => true,
        ]);
    }

    private function expense(string $status = Expense::STATUS_DRAFT, float $amount = 8000): Expense
    {
        return Expense::create([
            'number' => sprintf('EXP-EDI-%03d', ++$this->sequence),
            'agency_id' => $this->agency->id,
            'category_id' => $this->category->id,
            'amount' => $amount,
            'expense_date' => '2026-11-13',
            'status' => $status,
            'requested_by' => $this->actor->id,
        ]);
    }

    public function test_a_submitted_expense_can_be_edited(): void
    {
        $expense = $this->expense(Expense::STATUS_SUBMITTED);

        $this->putJson("/api/expenses/{$expense->id}", [
            'category_id' => $this->category->id,
            'amount' => 12000,
            'expense_date' => '2026-11-14',
            'note' => 'Montant corrigé',
        ])->assertOk();

        $expense->refresh();
        $this->assertEquals(12000, $expense->amount);
        $this->assertSame('Montant corrigé', $expense->note);
    }

    public function test_a_paid_expense_can_no_longer_be_edited(): void
    {
        $expense = $this->expense(Expense::STATUS_PAID);

        $this->putJson("/api/expenses/{$expense->id}", [
            'category_id' => $this->category->id,
            'amount' => 12000,
            'expense_date' => '2026-11-14',
        ])->assertStatus(422);
    }

    public function test_cancelling_a_paid_expense_reverses_cash_and_accounting(): void
    {
        $account = $this->account();
        $expense = $this->expense(Expense::STATUS_APPROVED);

        $this->postJson("/api/expenses/{$expense->id}/pay", [
            'treasury_account_id' => $account->id,
        ])->assertOk();

        $this->assertEquals(42000, $account->fresh()->computed_balance);
        $this->assertSame(1, AccountingTransaction::where('reference', $expense->number)->count());

        $this->postJson("/api/expenses/{$expense->id}/cancel")->assertOk();

        $expense->refresh();
        $this->assertNotNull($expense->cancelled_at);
        $this->assertTrue($expense->is_cancelled);
        $this->assertEquals(50000, $account->fresh()->computed_balance);
        $this->assertSame(0, AccountingTransaction::where('reference', $expense->number)->count());
        $this->assertSame(1, TreasuryTransaction::where('source_type', 'expense')->where('source_id', $expense->id)->count());
        $this->assertSame(1, TreasuryTransaction::where('source_type', 'reversal')->count());
    }

    public function test_cancelling_an_unpaid_expense_just_marks_it(): void
    {
        $expense = $this->expense(Expense::STATUS_DRAFT);

        $this->postJson("/api/expenses/{$expense->id}/cancel")->assertOk();

        $this->assertNotNull($expense->fresh()->cancelled_at);
        $this->assertSame(0, TreasuryTransaction::count());
        $this->assertSame(0, AccountingTransaction::count());
    }

    public function test_an_expense_cannot_be_cancelled_twice(): void
    {
        $expense = $this->expense(Expense::STATUS_DRAFT);

        $this->postJson("/api/expenses/{$expense->id}/cancel")->assertOk();
        $this->postJson("/api/expenses/{$expense->id}/cancel")->assertStatus(422);
    }
}
