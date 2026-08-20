<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\City;
use App\Models\ClientCategory;
use App\Models\Country;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\CitySeeder;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase4CustomersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            AccountingCategorySeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            CitySeeder::class,
            ClientCategorySeeder::class,
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

    private function agencyIn(string $countryCode, string $cityName): Agency
    {
        $country = Country::where('code', $countryCode)->firstOrFail();
        $city = City::where('name', $cityName)->firstOrFail();

        return Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => "Agence {$cityName}",
            'type' => 'agency',
            'organization_id' => $country->organization_id,
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
        ]);
    }

    private function chief(string $roleName, Agency $agency): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);

        DB::table('user_assignments')->insert([
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

    private function category(string $slug): string
    {
        return ClientCategory::where('slug', $slug)->value('id');
    }

    private function createClient(array $overrides = []): array
    {
        $payload = array_merge([
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'email' => 'jean.dupont'.uniqid().'@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ], $overrides);

        return $this->postJson('/api/clients', $payload)->assertStatus(201)->json();
    }

    private function createPackFor(Agency $agency): array
    {
        $service = Service::factory()->create(['price' => 10000]);
        $pack = $this->postJson('/api/subscription-packs', [
            'agency_id' => $agency->id,
            'name' => 'Pack Starter',
            'description' => 'Pack de base',
            'price_per_month' => 10000,
            'services' => [
                ['service_id' => $service->id, 'price_per_month' => 10000],
            ],
        ])->assertStatus(201)->json();

        return $pack;
    }

    // ─── Classification et lieu d'enregistrement (spec §9.1, §9.2) ──────

    public function test_admin_can_create_client_with_classification_and_registration_location(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $doualaCity = City::where('name', 'Douala')->firstOrFail();
        $cmr = Country::where('code', 'CMR')->firstOrFail();
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $client = $this->createClient([
            'client_category_id' => $this->category('apprenant'),
            'status' => 'learning',
            'country_id' => $cmr->id,
            'city_id' => $doualaCity->id,
            'registered_agency_id' => $douala->id,
            'commercial_user_id' => $commercial->id,
            'registered_at' => '2026-01-15 10:00:00',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $client['id'],
            'client_category_id' => $this->category('apprenant'),
            'status' => 'learning',
            'country_id' => $cmr->id,
            'city_id' => $doualaCity->id,
            'registered_agency_id' => $douala->id,
            'commercial_user_id' => $commercial->id,
        ]);

        $detail = $this->getJson('/api/clients/'.$client['id'])->assertOk()->json();

        $this->assertSame('learning', $detail['status']);
        $this->assertSame('Apprenant', $detail['client_category']['name']);
        $this->assertSame('Agence Douala', $detail['registered_agency']['name']);
        $this->assertSame($commercial->id, $detail['referring_commercial']['id']);
        $this->assertSame('Cameroun', $detail['country_name']);
        $this->assertSame('Douala', $detail['region']);
        $this->assertSame('2026-01-15T10:00:00.000000Z', $detail['registered_at']);
    }

    public function test_create_client_defaults_to_lead_status_and_registration_now(): void
    {
        $this->admin();

        $client = $this->createClient();

        $this->assertDatabaseHas('users', [
            'id' => $client['id'],
            'status' => 'lead',
        ]);

        $saved = User::find($client['id']);
        $this->assertNotNull($saved->registered_at);
        $this->assertEqualsWithDelta(now()->timestamp, $saved->registered_at->timestamp, 30);
    }

    public function test_update_client_classification_status_and_location(): void
    {
        $this->admin();

        $client = $this->createClient();
        $yaounde = $this->agencyIn('CMR', 'Yaoundé');
        $yaoundeCity = City::where('name', 'Yaoundé')->firstOrFail();
        $cmr = Country::where('code', 'CMR')->firstOrFail();

        $updated = $this->putJson('/api/clients/'.$client['id'], [
            'status' => 'active',
            'client_category_id' => $this->category('abonne'),
            'country_id' => $cmr->id,
            'city_id' => $yaoundeCity->id,
            'registered_agency_id' => $yaounde->id,
        ])->assertOk()->json();

        $this->assertSame('active', $updated['status']);
        $this->assertSame('Abonné', $updated['client_category']['name']);
        $this->assertSame('Agence Yaoundé', $updated['registered_agency']['name']);

        $this->assertDatabaseHas('users', [
            'id' => $client['id'],
            'status' => 'active',
            'client_category_id' => $this->category('abonne'),
            'registered_agency_id' => $yaounde->id,
        ]);
    }

    public function test_invalid_status_is_rejected(): void
    {
        $this->admin();

        $this->postJson('/api/clients', [
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'email' => 'invalid-status@example.com',
            'status' => 'gold-membre',
        ])->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    // ─── Filtrage des clients (spec §9.4) ─────────────────────────────────

    public function test_client_list_filters_by_status_category_and_location(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $abidjan = $this->agencyIn('CIV', 'Abidjan');
        $doualaCity = City::where('name', 'Douala')->firstOrFail();
        $cmr = Country::where('code', 'CMR')->firstOrFail();

        $apprenant = $this->createClient([
            'client_category_id' => $this->category('apprenant'),
            'status' => 'learning',
            'country_id' => $cmr->id,
            'city_id' => $doualaCity->id,
            'registered_agency_id' => $douala->id,
        ]);
        $abonneDouala = $this->createClient([
            'client_category_id' => $this->category('abonne'),
            'status' => 'active',
            'registered_agency_id' => $douala->id,
        ]);
        $abonneAbidjan = $this->createClient([
            'client_category_id' => $this->category('abonne'),
            'status' => 'active',
            'registered_agency_id' => $abidjan->id,
        ]);

        $this->getJson('/api/clients?status=active')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/clients?status=learning')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/clients?client_category_id='.$this->category('abonne'))
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/clients?registered_agency_id='.$abidjan->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $abonneAbidjan['id']);
    }

    public function test_client_list_filters_by_country_city_commercial_and_dates(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $cmr = Country::where('code', 'CMR')->firstOrFail();
        $doualaCity = City::where('name', 'Douala')->firstOrFail();
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $this->createClient([
            'commercial_user_id' => $commercial->id,
            'country_id' => $cmr->id,
            'city_id' => $doualaCity->id,
            'registered_agency_id' => $douala->id,
            'registered_at' => '2026-03-01 08:00:00',
        ]);
        $this->createClient([
            'commercial_user_id' => $commercial->id,
            'country_id' => $cmr->id,
            'city_id' => $doualaCity->id,
            'registered_agency_id' => $douala->id,
            'registered_at' => '2026-04-01 08:00:00',
        ]);
        $this->createClient([
            'registered_at' => '2026-05-01 08:00:00',
        ]);

        $this->getJson('/api/clients?country_id='.$cmr->id)
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/clients?city_id='.$doualaCity->id)
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/clients?commercial_user_id='.$commercial->id)
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/clients?from=2026-03-15&to=2026-04-30')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    // ─── Application du périmètre (spec §3 sur les clients) ──────────────

    public function test_client_list_and_search_are_scoped_for_assigned_user(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $abidjan = $this->agencyIn('CIV', 'Abidjan');

        $this->createClient([
            'registered_agency_id' => $douala->id,
            'first_name' => 'Scopé',
        ]);
        $this->createClient([
            'registered_agency_id' => $abidjan->id,
            'first_name' => 'Hors',
        ]);

        $this->chief('responsable-agence', $douala);

        $clients = $this->getJson('/api/clients')->assertOk()->json();
        $this->assertCount(1, $clients['data']);

        $search = $this->getJson('/api/clients/search?q=Scopé')->assertOk()->json();
        $this->assertCount(1, $search);

        $this->getJson('/api/clients/search?q=Hors')->assertOk()->assertJsonCount(0);
    }

    // ─── Historique client (spec §9.3) ───────────────────────────────────

    public function test_client_history_returns_invoices_payments_subscriptions(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $client = $this->createClient(['registered_agency_id' => $douala->id]);

        $this->postJson('/api/invoices', [
            'agency_id' => $douala->id,
            'client_id' => $client['id'],
            'items' => [['label' => 'Formation', 'unit_price' => 100000, 'quantity' => 1]],
            'advance' => 100000,
            'payment_type' => 'cash',
        ])->assertStatus(201);

        $pack = $this->createPackFor($douala);
        $subscription = $this->postJson('/api/subscriptions', [
            'subscription_pack_id' => $pack['id'],
            'client_id' => $client['id'],
            'months' => 3,
        ])->assertStatus(201)->json();

        $this->assertDatabaseCount('subscriptions', 1);

        $history = $this->getJson('/api/clients/'.$client['id'].'/history')->assertOk()->json();

        $this->assertEquals(2, $history['summary']['invoices_count']);
        $this->assertEquals(130000, $history['summary']['total_billed']);
        $this->assertEquals(100000, $history['summary']['total_paid']);
        $this->assertEquals(30000, $history['summary']['balance_due']);
        $this->assertEquals(1, $history['summary']['subscriptions_count']);

        $paidInvoice = collect($history['invoices'])->firstWhere('status', 'paid');
        $this->assertSame('cash', $history['payments'][0]['method']);
        $this->assertTrue($history['payments'][0]['is_advance']);
        $this->assertEquals(100000, $paidInvoice['total']);
        $this->assertSame('Pack Starter', $history['subscriptions'][0]['pack']);
        $this->assertSame(3, $history['subscriptions'][0]['months']);
        $this->assertNotNull($subscription['id']);
    }

    public function test_history_rejects_non_client_user(): void
    {
        $this->admin();

        $staff = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $this->getJson('/api/clients/'.$staff->id.'/history')
            ->assertStatus(404);
    }

    // ─── Export clients enrichi (spec §9.5) ──────────────────────────────

    public function test_export_clients_contains_classification_and_registration_columns(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $this->createClient([
            'client_category_id' => $this->category('apprenant'),
            'status' => 'learning',
            'registered_agency_id' => $douala->id,
        ]);

        $csv = $this->get('/api/exports/clients')->assertOk()->streamedContent();

        $this->assertStringContainsString('Catégorie', $csv);
        $this->assertStringContainsString('Agence d\'enregistrement', $csv);
        $this->assertStringContainsString('Commercial référent', $csv);
        $this->assertStringContainsString('Enregistré le', $csv);
        $this->assertStringContainsString('Apprenant', $csv);
        $this->assertStringContainsString('learning', $csv);
        $this->assertStringContainsString('Agence Douala', $csv);
    }

    public function test_export_clients_is_scoped_and_filterable(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $abidjan = $this->agencyIn('CIV', 'Abidjan');

        $visible = $this->createClient([
            'registered_agency_id' => $douala->id,
            'status' => 'active',
            'first_name' => 'Visiblescopé',
        ]);
        $this->createClient([
            'registered_agency_id' => $abidjan->id,
            'status' => 'active',
        ]);
        $this->createClient([
            'registered_agency_id' => $abidjan->id,
            'status' => 'lead',
        ]);

        $this->chief('responsable-agence', $douala);

        $csv = $this->get('/api/exports/clients?status=active')->assertOk()->streamedContent();

        $this->assertStringContainsString('Visiblescopé', $csv);
        $this->assertStringNotContainsString('Agence Abidjan', $csv);

        $lines = array_filter(explode("\n", $csv));
        $this->assertCount(2, $lines); // en-tête + 1 ligne scoped
    }
}