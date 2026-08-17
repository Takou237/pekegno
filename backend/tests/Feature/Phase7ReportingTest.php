<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class Phase7ReportingTest extends TestCase
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

    private function createCommercial(array $attributes = []): array
    {
        return $this->postJson('/api/commercials', array_merge([
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'commission_type' => 'percent',
            'commission_value' => 10,
        ], $attributes))->assertStatus(201)->json();
    }

    private function createInvoice(array $attributes = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'items' => [
                ['label' => 'Formation', 'unit_price' => 10000, 'quantity' => 1],
            ],
        ], $attributes))->assertStatus(201)->json();
    }

    private function createProspect(array $attributes = []): array
    {
        return $this->postJson('/api/prospects', array_merge([
            'first_name' => 'Paul',
            'last_name' => 'Prospect',
            'email' => 'prospect@example.com',
        ], $attributes))->assertStatus(201)->json();
    }

    public function test_report_aggregates_sales_payments_and_commissions(): void
    {
        $this->actingAsAdmin();

        $commercial = $this->createCommercial();
        $employee = $this->createCommercial([
            'first_name' => 'Eve',
            'last_name' => 'Employée',
            'kind' => 'employe',
            'commission_type' => 'fixed',
            'commission_value' => 500,
        ]);

        $invoice = $this->createInvoice([
            'commercial_id' => $commercial['id'],
            'advance' => 5000,
            'payment_type' => 'cash',
        ]);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", [
            'amount' => 5000,
            'payment_method' => 'mobile',
        ])->assertOk();

        $what = $this->createInvoice([
            'commercial_id' => $employee['id'],
            'advance' => 10000,
            'payment_type' => 'cash',
        ]);
        $this->assertNotEmpty($what['id']);

        $report = $this->getJson('/api/commercials/report')
            ->assertOk()
            ->json();

        $this->assertCount(2, $report['ranking']);

        $row = collect($report['ranking'])->firstWhere('id', $commercial['id']);
        $this->assertEquals(1, $row['sales_count']);
        $this->assertEquals(10000, $row['revenue_billed']);
        $this->assertEquals(10000, $row['revenue_received']);
        $this->assertEquals(2, $row['payments_count']);
        $this->assertEquals(1000, $row['commissions']);

        $employeeRow = collect($report['ranking'])->firstWhere('id', $employee['id']);
        $this->assertEquals('employe', $employeeRow['kind']);
        $this->assertEquals(1, $employeeRow['sales_count']);

        $this->assertEquals(2, $report['totals']['sales_count']);
        $this->assertEquals(20000, $report['totals']['revenue_billed']);
        $this->assertEquals(20000, $report['totals']['revenue_received']);
        $this->assertEquals(1500, $report['totals']['commissions']);
    }

    public function test_report_filters_by_kind_agency_and_commercial(): void
    {
        $this->actingAsAdmin();

        $agency = $this->postJson('/api/agencies', [
            'name' => 'Agence Douala',
            'code' => 'DLA',
            'country' => 'Cameroun',
            'city' => 'Douala',
        ])->assertStatus(201)->json();

        $commercial = $this->createCommercial(['agency_id' => $agency['id']]);
        $employee = $this->createCommercial([
            'kind' => 'employe',
            'commission_type' => 'none',
        ]);

        $this->createInvoice(['commercial_id' => $commercial['id'], 'advance' => 10000, 'payment_type' => 'cash']);
        $this->createInvoice([
            'commercial_id' => $employee['id'],
            'items' => [['label' => 'Formation', 'unit_price' => 20000, 'quantity' => 1]],
            'advance' => 20000,
            'payment_type' => 'cash',
        ]);

        $byKind = $this->getJson('/api/commercials/report?kind=employe')->assertOk()->json();
        $this->assertCount(1, $byKind['ranking']);
        $this->assertSame($employee['id'], $byKind['ranking'][0]['id']);

        $byAgency = $this->getJson('/api/commercials/report?agency_id='.$agency['id'])->assertOk()->json();
        $this->assertCount(1, $byAgency['ranking']);
        $this->assertSame($agency['name'], $byAgency['ranking'][0]['agency_name']);

        $byCommercial = $this->getJson('/api/commercials/report?commercial_id='.$commercial['id'])->assertOk()->json();
        $this->assertCount(1, $byCommercial['ranking']);

        $period = $this->getJson('/api/commercials/report?from=2025-01-01&to=2025-01-31')->assertOk()->json();
        $this->assertEquals(0, $period['totals']['sales_count']);
    }

    public function test_report_counts_prospects_points_and_conversion(): void
    {
        $this->actingAsAdmin();

        $commercial = $this->createCommercial(['commission_type' => 'none']);

        $this->createProspect(['commercial_id' => $commercial['id']]);
        $this->createProspect(['commercial_id' => $commercial['id']]);

        $client = $this->postJson('/api/clients', [
            'first_name' => 'Client',
            'last_name' => 'Converti',
            'email' => 'converti@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(201)->json();

        $this->createInvoice([
            'commercial_id' => $commercial['id'],
            'client_id' => $client['id'],
            'advance' => 10000,
            'payment_type' => 'cash',
        ]);

        $report = $this->getJson('/api/commercials/report?commercial_id='.$commercial['id'])
            ->assertOk()
            ->json();

        $row = $report['ranking'][0];
        $this->assertEquals(2, $row['prospects_count']);
        $this->assertEquals(1, $row['clients_converted']);
        $this->assertEquals(33.3, $row['conversion_rate']);
    }

    public function test_report_is_exported_as_xlsx(): void
    {
        $this->actingAsAdmin();

        Excel::fake();

        $this->getJson('/api/exports/commercial-report')
            ->assertOk();

        Excel::assertDownloaded(
            'reporting-commercial-'.now()->startOfMonth()->format('Y-m-d').'-'.now()->format('Y-m-d').'.xlsx'
        );
    }

    public function test_report_forbidden_for_client(): void
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        Sanctum::actingAs($client);

        $this->getJson('/api/commercials/report')->assertForbidden();
    }
}
