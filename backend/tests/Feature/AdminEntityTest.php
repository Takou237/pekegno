<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Country;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * T3.1 à T3.4 — Administration par pays.
 */
class AdminEntityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Country $country;
    private Agency $agencyDouala;
    private Agency $agencyAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);

        $adminRole = Role::where('name', 'super-admin')->first();
        $this->admin = User::factory()->create([
            'role_id' => $adminRole->id,
            'email' => 'admin@pekegno.test',
        ]);

        $this->country = Country::create([
            'name' => 'Cameroun',
            'code' => 'CM',
            'currency_code' => 'XAF',
            'exchange_rate' => 1.0,
            'phone_code' => '237',
        ]);

        // Agence opérationnelle Douala
        $this->agencyDouala = Agency::create([
            'name' => 'Douala',
            'code' => 'DLA',
            'type' => Agency::TYPE_AGENCY,
            'country_id' => $this->country->id,
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);

        // Entité Administration Cameroun
        $this->agencyAdmin = Agency::create([
            'name' => 'Administration Cameroun',
            'code' => 'ADM-CM',
            'type' => Agency::TYPE_ADMINISTRATION,
            'country_id' => $this->country->id,
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);
    }

    public function test_country_dashboard_returns_operational_and_admin_bodies(): void
    {
        $this->actingAs($this->admin);

        $service = Service::factory()->create(['price' => 10000]);

        // Facture 1 sur l'agence Douala : 500 000 FCFA
        $invoiceDouala = Invoice::create([
            'number' => 'FAC-DLA-01',
            'agency_id' => $this->agencyDouala->id,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->toDateString(),
            'total_amount' => 500000,
            'amount_paid' => 500000,
            'payment_status' => 'paid',
            'validation_status' => 'validated',
        ]);
        InvoiceItem::create([
            'invoice_id' => $invoiceDouala->id,
            'service_id' => $service->id,
            'label' => 'Prestation Douala',
            'quantity' => 1,
            'unit_price' => 500000,
            'line_total' => 500000,
        ]);

        $res = $this->getJson("/api/stats/country/{$this->country->id}")
            ->assertOk()
            ->json();

        // Total pays
        $this->assertEquals(500000, $res['revenue']);

        // Corps opérationnel vs administration
        $this->assertArrayHasKey('operational_kpi', $res);
        $this->assertArrayHasKey('administration_kpi', $res);

        $this->assertEquals(500000, $res['operational_kpi']['revenue']);
        $this->assertEquals(0, $res['administration_kpi']['revenue']);
    }
}
