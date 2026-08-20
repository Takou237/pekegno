<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\DailyBalance;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
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

    private function createAgency(): Agency
    {
        return Agency::factory()->create();
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

        $agency = $this->createAgency();
        $this->createInvoice(['agency_id' => $agency->id, 'advance' => 25000, 'payment_type' => 'cash']);

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertSame(now()->toDateString(), $bilan['date']);
        $this->assertCount(2, $bilan['services_by_category']);
        $this->assertEquals(1, collect($bilan['services_by_category'])->firstWhere('label', 'Formation')['count']);
        $this->assertEquals(15000, collect($bilan['services_by_category'])->firstWhere('label', 'Formation')['total']);
        $this->assertEquals(2, collect($bilan['services_by_category'])->firstWhere('label', 'Coaching')['count']);
        $this->assertEquals(10000, collect($bilan['services_by_category'])->firstWhere('label', 'Coaching')['total']);
        $this->assertEquals(3, $bilan['total_ventes']);
        $this->assertEquals(25000, $bilan['cash_total']);
        $this->assertEquals(25000, $bilan['total_received']);
    }

    public function test_daily_bilan_splits_cash_and_mobile(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $this->createInvoice([
            'agency_id' => $agency->id,
            'items' => [['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1]],
            'advance' => 15000,
            'payment_type' => 'cash',
        ]);
        $this->createInvoice([
            'agency_id' => $agency->id,
            'items' => [['label' => 'Coaching', 'unit_price' => 5000, 'quantity' => 2]],
            'advance' => 10000,
            'payment_type' => 'momo',
        ]);

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertEquals(15000, $bilan['cash_total']);
        $this->assertEquals(10000, $bilan['momo_total']);
        $this->assertEquals(25000, $bilan['total_received']);
        $this->assertEquals(3, $bilan['total_ventes']);
        $this->assertEquals(25000, $bilan['solde_final']);
    }

    public function test_daily_bilan_excludes_cancelled_invoices(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $invoice = $this->createInvoice(['agency_id' => $agency->id, 'advance' => 15000, 'payment_type' => 'cash']);
        $this->postJson("/api/invoices/{$invoice['id']}/cancel")->assertOk();

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertEquals(0, $bilan['total_ventes']);
        $this->assertEquals(0, $bilan['cash_total']);
    }

    public function test_daily_bilan_filters_by_agency(): void
    {
        $this->actingAsAdmin();

        $agencyA = $this->createAgency();

        $this->createInvoice(['agency_id' => $agencyA->id, 'advance' => 25000, 'payment_type' => 'cash']);

        $filtered = $this->getJson("/api/bilans?agency_id={$agencyA->id}")->assertOk()->json();
        $this->assertEquals(25000, $filtered['total_received']);
        $this->assertEquals(25000, $filtered['cash_total']);
        $this->assertSame($agencyA->id, $filtered['agency_id']);

        $agencyB = $this->createAgency();
        $this->createInvoice([
            'agency_id' => $agencyB->id,
            'items' => [['label' => 'Coaching', 'unit_price' => 7000, 'quantity' => 1]],
            'advance' => 7000,
            'payment_type' => 'om',
        ]);

        $global = $this->getJson('/api/bilans')->assertOk()->json();
        $this->assertEquals(32000, $global['totals']['total_encaisse']);
        $this->assertEquals(25000, $global['totals']['total_cash']);
        $this->assertEquals(7000, $global['totals']['total_om']);
        $this->assertCount(2, $global['agencies']);
    }

    public function test_daily_bilan_subtracts_expense_and_computes_final_balance(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $this->createInvoice(['agency_id' => $agency->id, 'advance' => 25000, 'payment_type' => 'cash']);

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Achat carburant',
            'amount' => 2000,
            'agency_id' => $agency->id,
            'beneficiary' => 'Station Total',
            'justification' => 'Déplacement direction',
        ])->assertStatus(201);

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertEquals(2000, $bilan['expense_total']);
        $this->assertEquals(23000, $bilan['solde_final']);
        $this->assertEquals(25000, $bilan['total_received']);
    }

    public function test_daily_bilan_opening_balance_from_previous_day(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $invoice = $this->createInvoice(['agency_id' => $agency->id]);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 25000,
            'payment_method' => 'cash',
            'paid_at' => now()->subDay()->toDateString(),
        ])->assertOk();

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertEquals(0, $bilan['total_received']);
        $this->assertEquals(25000, $bilan['solde_initial']);
        $this->assertEquals(25000, $bilan['solde_final']);

        $this->assertDatabaseHas('daily_balances', [
            'date' => now()->toDateString(),
            'agency_id' => $agency->id,
            'solde_initial' => 25000,
        ]);
    }

    public function test_daily_bilan_uses_stored_closing_balance_as_next_opening(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $this->createInvoice(['agency_id' => $agency->id, 'advance' => 25000, 'payment_type' => 'cash']);
        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Réparation',
            'amount' => 3000,
            'agency_id' => $agency->id,
            'beneficiary' => 'Garage X',
            'justification' => 'Maintenance',
        ])->assertStatus(201);

        $today = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();
        $this->assertEquals(22000, $today['solde_final']);

        $tomorrow = $this->getJson('/api/bilans?agency_id='.$agency->id.'&date='.now()->addDay()->toDateString())->assertOk()->json();
        $this->assertEquals(22000, $tomorrow['solde_initial']);
    }

    public function test_daily_bilan_counts_unpaid_services_without_received(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $this->createInvoice(['agency_id' => $agency->id]);

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertEquals(3, $bilan['total_ventes']);
        $this->assertEquals(0, $bilan['total_received']);
    }

    public function test_daily_bilan_excludes_previous_days_services(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $this->createInvoice(['agency_id' => $agency->id, 'invoice_date' => now()->subDay()->toDateString()]);

        $bilan = $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk()->json();

        $this->assertEquals(0, $bilan['total_ventes']);
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
        $this->getJson('/api/bilans?date='.now()->toDateString())->assertOk();
    }

    public function test_daily_bilan_export_csv(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['advance' => 25000, 'payment_type' => 'cash']);

        $this->getJson('/api/exports/bilans?date='.now()->toDateString())
            ->assertOk()
            ->assertDownload('bilan-global-'.now()->format('Y-m-d').'.csv');
    }

    public function test_daily_balance_model_stores_row(): void
    {
        $this->actingAsAdmin();

        $agency = $this->createAgency();
        $this->createInvoice([
            'agency_id' => $agency->id,
            'items' => [['label' => 'Coaching', 'unit_price' => 10000, 'quantity' => 1]],
            'advance' => 10000,
            'payment_type' => 'mobile',
        ]);

        $this->getJson('/api/bilans?agency_id='.$agency->id)->assertOk();

        $this->assertDatabaseHas('daily_balances', [
            'date' => now()->toDateString(),
            'agency_id' => $agency->id,
            'solde_initial' => 0,
            'solde_final' => 10000,
        ]);

        $this->assertSame(1, DailyBalance::count());
    }
}