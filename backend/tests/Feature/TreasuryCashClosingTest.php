<?php

namespace Tests\Feature;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\AgencyNotification;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\TreasuryService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T2.2–T2.10 : caisses codifiées, visibilité par rôle, ventilation des
 * paiements, clôture journalière avec justification et alerte d'écart.
 */
class TreasuryCashClosingTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
    }

    private function userWithRole(string $role, bool $assign = true): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);

        if ($assign) {
            $user->assignments()->sync([$this->agency->id => ['is_primary' => true]]);
        }

        return $user;
    }

    private function account(string $code, string $type, ?array $roles = null): TreasuryAccount
    {
        return TreasuryAccount::create([
            'agency_id' => $this->agency->id,
            'code' => $code,
            'name' => $code,
            'type' => $type,
            'opening_balance' => 0,
            'currency_code' => 'XAF',
            'is_active' => true,
            'visible_roles' => $roles,
        ]);
    }

    private function restricted(): array
    {
        return ['super-admin', 'direction-generale', 'comptable'];
    }

    public function test_cashier_only_sees_the_cash_account(): void
    {
        $cash = $this->account('C', 'cash');
        $orange = $this->account('O', 'mobile_money', $this->restricted());
        $this->account('M', 'mobile_money', $this->restricted());
        $this->account('B', 'bank', $this->restricted());

        $cashier = $this->userWithRole('caissier');
        Sanctum::actingAs($cashier);

        $accounts = $this->getJson('/api/treasury/accounts')->assertOk()->json();

        $this->assertCount(1, $accounts);
        $this->assertSame($cash->id, $accounts[0]['id']);

        $this->getJson("/api/treasury/accounts/{$orange->id}")->assertForbidden();
    }

    public function test_admin_sees_all_accounts(): void
    {
        $this->account('C', 'cash');
        $this->account('O', 'mobile_money', $this->restricted());

        Sanctum::actingAs($this->userWithRole('super-admin'));

        $this->getJson('/api/treasury/accounts')->assertOk()->assertJsonCount(2);
    }

    public function test_payment_is_ventilated_to_the_account_matching_the_method(): void
    {
        $orange = $this->account('O', 'mobile_money', $this->restricted());

        $commercial = $this->userWithRole('commercial', false);
        Commercial::factory()->create(['user_id' => $commercial->id, 'agency_id' => $this->agency->id]);

        $invoice = Invoice::create([
            'number' => 'FAC-'.uniqid(),
            'agency_id' => $this->agency->id,
            'client_id' => $this->userWithRole('client', false)->id,
            'seller_user_id' => $commercial->id,
            'commercial_id' => $commercial->commercialProfile->id,
            'invoice_date' => now()->toDateString(),
            'payment_type' => 'cash',
            'total_amount' => 10000,
            'amount_paid' => 0,
            'declared_advance' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'pending',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'validated_at' => now(),
        ]);

        $cashier = $this->userWithRole('caissier');
        Sanctum::actingAs($cashier);

        $this->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => 10000,
            'payment_method' => 'om',
        ])->assertOk();

        $payment = InvoicePayment::where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertSame($orange->id, $payment->treasury_account_id);
    }

    public function test_cash_closing_requires_a_justification_when_there_is_a_difference(): void
    {
        $cash = $this->account('C', 'cash');
        app(TreasuryService::class)->recordMovement($cash, TreasuryTransaction::DIRECTION_IN, 10000, 'Vente');

        $cashier = $this->userWithRole('caissier');
        Sanctum::actingAs($cashier);

        $this->postJson('/api/treasury/closings', [
            'treasury_account_id' => $cash->id,
            'actual_balance' => 9000,
        ])->assertStatus(422);

        $closing = $this->postJson('/api/treasury/closings', [
            'treasury_account_id' => $cash->id,
            'actual_balance' => 9000,
            'justification' => 'Billet manquant',
        ])->assertStatus(201)->json();

        $this->assertSame(10000.0, (float) $closing['theoretical_balance']);
        $this->assertSame(-1000.0, (float) $closing['difference']);

        $this->assertSame(1, AgencyNotification::where('type', 'cash_closing_discrepancy')->count());
    }

    public function test_cash_closing_without_difference_needs_no_justification(): void
    {
        $cash = $this->account('C', 'cash');
        app(TreasuryService::class)->recordMovement($cash, TreasuryTransaction::DIRECTION_IN, 7500, 'Vente');

        Sanctum::actingAs($this->userWithRole('caissier'));

        $closing = $this->postJson('/api/treasury/closings', [
            'treasury_account_id' => $cash->id,
            'actual_balance' => 7500,
        ])->assertStatus(201)->json();

        $this->assertSame(0.0, (float) $closing['difference']);
        $this->assertSame(0, AgencyNotification::where('type', 'cash_closing_discrepancy')->count());
    }

    public function test_transfer_is_typed_and_never_recorded_as_an_expense(): void
    {
        $cash = $this->account('C', 'cash');
        $bank = $this->account('B', 'bank', $this->restricted());

        Sanctum::actingAs($this->userWithRole('super-admin'));

        $this->postJson('/api/treasury/transfer', [
            'from_account_id' => $cash->id,
            'to_account_id' => $bank->id,
            'amount' => 50000,
            'transfer_type' => 'bank_deposit',
        ])->assertOk();

        $this->assertSame(
            2,
            TreasuryTransaction::where('transfer_type', 'bank_deposit')->count()
        );
        $this->assertSame(0, AccountingTransaction::where('type', 'expense')->count());
        $this->assertSame(-50000.0, (float) $cash->fresh()->computed_balance);
        $this->assertSame(50000.0, (float) $bank->fresh()->computed_balance);
    }

    public function test_transfer_type_is_validated(): void
    {
        $cash = $this->account('C', 'cash');
        $bank = $this->account('B', 'bank', $this->restricted());

        Sanctum::actingAs($this->userWithRole('super-admin'));

        $this->postJson('/api/treasury/transfer', [
            'from_account_id' => $cash->id,
            'to_account_id' => $bank->id,
            'amount' => 1000,
            'transfer_type' => 'expense',
        ])->assertStatus(422);
    }

    public function test_a_closed_cash_must_be_reopened_before_closing_again(): void
    {
        $cash = $this->account('C', 'cash');
        Sanctum::actingAs($this->userWithRole('caissier'));

        $payload = ['treasury_account_id' => $cash->id, 'actual_balance' => 0];

        $this->postJson('/api/treasury/closings', $payload)->assertStatus(201);
        $this->postJson('/api/treasury/closings', $payload)->assertStatus(422);
        $this->postJson("/api/treasury/accounts/{$cash->id}/reopen")->assertOk();
        // Nouvelle journée : une seconde clôture le même jour est permise.
        $this->postJson('/api/treasury/closings', $payload)->assertStatus(201);
    }
}
