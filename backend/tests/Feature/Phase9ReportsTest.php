<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Role;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase9ReportsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            CitySeeder::class,
        ]);
    }

    private function admin(): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function agencyIn(string $countryCode): Agency
    {
        $country = Country::where('code', $countryCode)->firstOrFail();
        $city = \App\Models\City::where('country_id', $country->id)->firstOrFail();

        return Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => "Agence {$country->code}",
            'type' => 'agency',
            'organization_id' => $country->organization_id,
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
        ]);
    }

    private function chief(Agency $agency): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'responsable-agence')->value('id'),
        ]);

        \Illuminate\Support\Facades\DB::table('user_assignments')->insert([
            'user_id' => $user->id,
            'agency_id' => $agency->id,
            'department_id' => null,
            'is_primary' => true,
            'is_department_chief' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($user);

        return $user;
    }

    private function createClient(array $overrides = []): User
    {
        $country = Country::firstOrFail();
        $city = \App\Models\City::where('country_id', $country->id)->firstOrFail();

        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', 'client')->value('id'),
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
        ], $overrides));
    }

    private function createPack(array $overrides = []): array
    {
        return $this->postJson('/api/subscription-packs', array_merge([
            'agency_id' => Agency::factory()->create()->id,
            'name' => 'Pack Pro',
            'price_per_month' => 10000,
            'services' => [
                ['service_id' => Service::factory()->create(['price' => 10000])->id, 'price_per_month' => 5000],
            ],
        ], $overrides))->assertStatus(201)->json();
    }

    private function createSubscription(array $overrides = []): array
    {
        $agencyId = $overrides['agency_id'] ?? null;
        $pack = $agencyId
            ? $this->createPack(['agency_id' => $agencyId])
            : $this->createPack();

        return $this->postJson('/api/subscriptions', array_merge([
            'subscription_pack_id' => $pack['id'],
            'client_id' => $this->createClient()->id,
            'months' => 3,
        ], $overrides))->assertStatus(201)->json();
    }

    private function createPaidInvoice(Agency $agency, User $client, ?Commercial $commercial = null, ?float $amount = null): Invoice
    {
        $service = Service::factory()->create(['price' => $amount ?? 20000]);
        $invoice = Invoice::create([
            'number' => 'INV-'.fake()->unique()->numerify('#####'),
            'agency_id' => $agency->id,
            'client_id' => $client->id,
            'client_name' => $client->first_name.' '.$client->last_name,
            'commercial_id' => $commercial?->id,
            'invoice_date' => now(),
            'total_amount' => $service->price,
            'amount_paid' => $service->price,
            'status' => 'paid',
        ]);

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'service_id' => $service->id,
            'label' => $service->name,
            'unit_price' => $service->price,
            'quantity' => 1,
            'line_total' => $service->price,
        ]);

        return $invoice;
    }

    // ─── Rapport abonnements ─────────────────────────────────────────────

    public function test_subscription_report_sums_statuses_packs_and_trend(): void
    {
        $this->admin();
        $active = $this->createSubscription(['months' => 3]);
        $this->createSubscription(['months' => 3]);

        $renewed = $this->createSubscription(['months' => 1]);
        $this->postJson("/api/subscriptions/{$renewed['id']}/renew")->assertCreated();

        $expired = $this->createSubscription(['months' => 1]);
        Subscription::find($expired['id'])->update(['status' => 'expired', 'end_date' => today()->subDay()]);

        $response = $this->getJson('/api/reports/subscriptions')->assertOk()->json();

        $this->assertEquals(4, $response['totals']['subscriptions']);
        $this->assertEquals(2, $response['totals']['active']);
        $this->assertEquals(1, $response['totals']['renewed']);
        $this->assertEquals(1, $response['totals']['expired']);
        $this->assertEquals(2, $response['by_status']['active']['count']);
        $this->assertEquals(1, $response['by_status']['renewed']['count']);
        $this->assertTrue(collect($response['by_pack'])->contains('pack', 'Pack Pro'));
        $this->assertNotEmpty($response['trend']);
        $this->assertArrayHasKey('month', $response['trend'][0]);
    }

    public function test_subscription_report_respects_agency_scope(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $this->admin();
        $this->createSubscription(['agency_id' => $cmr->id]);
        $this->createSubscription(['agency_id' => $civ->id]);

        $this->chief($cmr);

        $this->getJson('/api/reports/subscriptions')
            ->assertOk()
            ->assertJsonPath('totals.subscriptions', 1);
    }

    // ─── Rapport clients ──────────────────────────────────────────────────

    public function test_customer_report_with_totals_top_and_commercials(): void
    {
        $this->admin();
        $agency = Agency::factory()->create();
        $clientA = $this->createClient();
        $clientB = $this->createClient();
        $commercial = Commercial::factory()->create(['agency_id' => $agency->id]);

        $this->createPaidInvoice($agency, $clientA, $commercial, 50000);
        $this->createPaidInvoice($agency, $clientA, $commercial, 30000);
        $this->createPaidInvoice($agency, $clientB, $commercial, 10000);

        $response = $this->getJson('/api/reports/customers')->assertOk()->json();

        $this->assertEquals(2, $response['totals']['clients_new']);
        $this->assertEquals(90000, (float) $response['totals']['turnover']);
        $this->assertCount(2, $response['top_clients']);
        $this->assertEquals(80000, (float) $response['top_clients'][0]['turnover']);
        $this->assertCount(1, $response['by_commercial']);
        $this->assertCount(1, $response['by_country']);
    }

    public function test_customer_report_accepts_date_range(): void
    {
        $this->admin();
        $agency = Agency::factory()->create();
        $client = $this->createClient();
        $client->update(['created_at' => now()->subMonths(6)]);
        $this->createPaidInvoice($agency, $client);

        $old = $this->getJson('/api/reports/customers?from=2020-01-01&to=2020-01-31')->assertOk()->json();
        $this->assertEquals(0, $old['totals']['clients_new']);

        $recent = $this->getJson('/api/reports/customers?from='.now()->subMonth()->format('Y-m-d').'&to='.now()->addDay()->format('Y-m-d'))->assertOk()->json();
        $this->assertEquals(1, $recent['totals']['clients_new']);
    }

    // ─── Comparaison ──────────────────────────────────────────────────────

    public function test_comparison_by_agency(): void
    {
        $this->admin();
        $agencyA = Agency::factory()->create(['name' => 'Agence A']);
        $agencyB = Agency::factory()->create(['name' => 'Agence B']);

        $this->createPaidInvoice($agencyA, $this->createClient(), null, 40000);
        $this->createPaidInvoice($agencyB, $this->createClient(), null, 10000);

        $response = $this->getJson('/api/reports/comparison?dimension=agency')->assertOk()->json();

        $this->assertEquals('agency', $response['dimension']);
        $this->assertEquals(50000, (float) $response['total_revenue']);
        $this->assertCount(2, $response['data']);
        $this->assertEquals('Agence A', $response['data'][0]['label']);
        $this->assertEquals(80.0, (float) $response['data'][0]['share']);
        $this->assertEquals(20.0, (float) $response['data'][1]['share']);
    }

    public function test_comparison_by_country(): void
    {
        $this->admin();
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $this->createPaidInvoice($cmr, $this->createClient(), null, 30000);
        $this->createPaidInvoice($civ, $this->createClient(), null, 15000);

        $response = $this->getJson('/api/reports/comparison?dimension=country')->assertOk()->json();

        $this->assertCount(2, $response['data']);
        $this->assertEquals(45000, (float) $response['total_revenue']);
        $this->assertContains($response['data'][0]['label'], ['Cameroun', "Côte d'Ivoire", 'Cameroon']);
    }

    public function test_comparison_rejects_invalid_dimension(): void
    {
        $this->admin();

        $this->getJson('/api/reports/comparison?dimension=continent')->assertStatus(422);
    }

    // ─── Permissions ──────────────────────────────────────────────────────

    public function test_reports_require_permission(): void
    {
        $user = $this->createClient();
        Sanctum::actingAs($user);

        $this->getJson('/api/reports/subscriptions')->assertForbidden();
        $this->getJson('/api/reports/customers')->assertForbidden();
        $this->getJson('/api/reports/comparison?dimension=agency')->assertForbidden();
    }
}