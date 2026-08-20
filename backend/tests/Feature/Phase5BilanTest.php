<?php

namespace Tests\Feature;

use App\Models\DailyBalance;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class Phase5BilanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createInvoice(array $attributes = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
                ['label' => 'Coaching', 'unit_price' => 5000, 'quantity' => 2],
            ],
        ], $attributes))->assertStatus(201)->json();
    }

    public function test_daily_bilan_returns_services_and_totals(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 25000, 'payment_type' => 'cash']);

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertSame(now()->toDateString(), $bilan['date']);
        $this->assertCount(2, $bilan['services']);
        $this->assertEquals(1, collect($bilan['services'])->firstWhere('label', 'Formation')['count']);
        $this->assertEquals(15000, collect($bilan['services'])->firstWhere('label', 'Formation')['total']);
        $this->assertEquals(2, collect($bilan['services'])->firstWhere('label', 'Coaching')['count']);
        $this->assertEquals(10000, collect($bilan['services'])->firstWhere('label', 'Coaching')['total']);
        $this->assertEquals(25000, $bilan['total_services_sold']);
        $this->assertEquals(25000, $bilan['cash_total']);
        $this->assertEquals(0, $bilan['om_total'] ?? 0);
        $this->assertTrue($bilan['coherence']['ok']);
    }

    public function test_daily_bilan_splits_cash_and_mobile(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice([
            'items' => [['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1]],
            'advance' => 15000,
            'payment_type' => 'cash',
        ]);
        $this->createInvoice([
            'items' => [['label' => 'Coaching', 'unit_price' => 5000, 'quantity' => 2]],
            'advance' => 10000,
            'payment_type' => 'momo',
        ]);

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertEquals(15000, $bilan['cash_total']);
        $this->assertEquals(10000, $bilan['momo_total']);
        $this->assertEquals(25000, $bilan['total_received']);
        $this->assertEquals(25000, $bilan['total_services_sold']);
        $this->assertTrue($bilan['coherence']['ok']);
    }

    public function test_daily_bilan_excludes_cancelled_invoices(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->createInvoice(['advance' => 15000, 'payment_type' => 'cash']);
        $this->postJson("/api/invoices/{$invoice['id']}/cancel")->assertOk();

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertEquals(0, $bilan['total_services_sold']);
        $this->assertEquals(0, $bilan['cash_total']);
    }

    public function test_daily_bilan_filters_by_agency(): void
    {
        $this->actingAsAdmin();

        $agency = $this->postJson('/api/agencies', [
            'name' => 'Agence Douala',
            'code' => 'DLA',
            'country' => 'Cameroun',
            'city' => 'Douala',
        ])->assertStatus(201)->json();

        $this->createInvoice(['advance' => 25000, 'payment_type' => 'cash']);
        $this->createInvoice([
            'agency_id' => $agency['id'],
            'advance' => 7000,
            'payment_type' => 'om',
        ]);

        $global = $this->getJson('/api/bilans')->assertOk()->json();
        $this->assertEquals(32000, $global['total_received']);

        $filtered = $this->getJson("/api/bilans?agency_id={$agency['id']}")->assertOk()->json();
        $this->assertEquals(7000, $filtered['total_received']);
        $this->assertEquals(0, $filtered['cash_total']);
        $this->assertEquals(7000, $filtered['om_total']);
        $this->assertSame($agency['id'], $filtered['agency_id']);
    }

    public function test_daily_bilan_subtracts_expense_and_computes_final_balance(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 25000, 'payment_type' => 'cash']);

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Achat carburant',
            'amount' => 2000,
            'beneficiary' => 'Station Total',
            'justification' => 'Déplacement direction',
        ])->assertStatus(201);

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertEquals(2000, $bilan['expense_total']);
        $this->assertEquals(23000, $bilan['solde_final']);
        $this->assertEquals(25000, $bilan['total_received']);
    }

    public function test_daily_bilan_opening_balance_from_previous_day(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->createInvoice([]);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 25000,
            'payment_method' => 'cash',
            'paid_at' => now()->subDay()->toDateString(),
        ])->assertOk();

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertEquals(0, $bilan['total_received']);
        $this->assertEquals(25000, $bilan['solde_initial']);
        $this->assertEquals(0, $bilan['solde_final']);

        $this->assertDatabaseHas('daily_balances', [
            'date' => now()->toDateString(),
            'solde_initial' => 25000,
        ]);
    }

    public function test_daily_bilan_uses_stored_closing_balance_as_next_opening(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 25000, 'payment_type' => 'cash']);
        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Réparation',
            'amount' => 3000,
            'beneficiary' => 'Garage X',
            'justification' => 'Maintenance',
        ])->assertStatus(201);

        $today = $this->getJson('/api/bilans')->assertOk()->json();
        $this->assertEquals(22000, $today['solde_final']);

        $tomorrow = $this->getJson('/api/bilans?date='.now()->addDay()->toDateString())->assertOk()->json();
        $this->assertEquals(22000, $tomorrow['solde_initial']);
    }

    public function test_daily_bilan_flags_coherence_gap(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice([]);

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertEquals(25000, $bilan['total_services_sold']);
        $this->assertEquals(0, $bilan['total_received']);
        $this->assertFalse($bilan['coherence']['ok']);
    }

    public function test_daily_bilan_excludes_previous_days_services(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['invoice_date' => now()->subDay()->toDateString()]);

        $bilan = $this->getJson('/api/bilans')->assertOk()->json();

        $this->assertEquals(0, $bilan['total_services_sold']);
    }

    public function test_daily_bilan_requires_permission(): void
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        Sanctum::actingAs($client);

        $this->getJson('/api/bilans')->assertForbidden();
    }

    public function test_daily_bilan_allowed_for_caissier(): void
    {
        $caissier = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        Sanctum::actingAs($caissier);

        $this->getJson('/api/bilans')->assertOk();
    }

    public function test_daily_bilan_export_excel(): void
    {
        Excel::fake();

        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 25000, 'payment_type' => 'cash']);

        $this->getJson('/api/exports/bilans?date='.now()->toDateString())
            ->assertOk();

        Excel::assertDownloaded('bilan-du-jour-'.now()->format('Y-m-d').'.xlsx');
    }

    public function test_daily_balance_model_stores_row(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 10000, 'payment_type' => 'mobile']);

        $this->getJson('/api/bilans')->assertOk();

        $this->assertDatabaseHas('daily_balances', [
            'date' => now()->toDateString(),
            'agency_id' => null,
            'solde_initial' => 0,
            'solde_final' => 10000,
        ]);

        $this->assertSame(1, DailyBalance::count());
    }
}
