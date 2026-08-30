<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Role;
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

class Phase3OrganizationTest extends TestCase
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

    private function createInvoice(array $attributes = []): void
    {
        $this->postJson('/api/invoices', array_merge([
            'items' => [
                ['label' => 'Formation', 'unit_price' => 100000, 'quantity' => 1],
            ],
        ], $attributes))->assertStatus(201);
    }

    // ─── Pays ────────────────────────────────────────────────────────────

    public function test_admin_can_crud_country(): void
    {
        $this->admin();

        $created = $this->postJson('/api/countries', [
            'name' => 'Sénégal',
            'code' => 'SEN',
            'iso_code' => 'SEN',
            'phone_code' => '+221',
            'currency_code' => 'XOF',
        ])->assertStatus(201)->assertJsonPath('name', 'Sénégal')->json();

        $this->assertDatabaseHas('countries', ['code' => 'SEN']);

        $this->getJson('/api/countries?search=Sénégal')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->putJson('/api/countries/'.$created['id'], ['currency_code' => 'XOF', 'is_active' => false])
            ->assertOk()
            ->assertJsonPath('is_active', false);

        $this->getJson('/api/countries/'.$created['id'])->assertOk();

        $this->deleteJson('/api/countries/'.$created['id'])->assertStatus(204);
        $this->assertDatabaseMissing('countries', ['id' => $created['id']]);
    }

    public function test_country_code_and_iso_must_be_unique(): void
    {
        $this->admin();

        $this->postJson('/api/countries', [
            'name' => 'Doublon',
            'code' => 'CMR',
            'currency_code' => 'XAF',
        ])->assertStatus(422)->assertJsonValidationErrors(['code']);

        $this->postJson('/api/countries', [
            'name' => 'Sénégal',
            'code' => 'SEN',
            'iso_code' => 'SEN',
            'currency_code' => 'XOF',
        ])->assertStatus(201);

        $this->postJson('/api/countries', [
            'name' => 'Doublon ISO',
            'code' => 'DUB',
            'iso_code' => 'SEN',
            'currency_code' => 'XOF',
        ])->assertStatus(422)->assertJsonValidationErrors(['iso_code']);
    }

    public function test_country_with_cities_cannot_be_deleted(): void
    {
        $this->admin();

        $cmr = Country::where('code', 'CMR')->firstOrFail();

        $this->deleteJson('/api/countries/'.$cmr->id)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Impossible de supprimer un pays qui possède encore des villes ou des agences.');
    }

    public function test_user_without_countries_permission_gets_403(): void
    {
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Sanctum::actingAs($commercial);

        $this->getJson('/api/countries')->assertForbidden();
        $this->postJson('/api/countries', ['name' => 'X', 'code' => 'XX', 'currency_code' => 'XAF'])->assertForbidden();
    }

    // ─── Villes ──────────────────────────────────────────────────────────

    public function test_admin_can_crud_city(): void
    {
        $this->admin();

        $senegal = $this->postJson('/api/countries', [
            'name' => 'Sénégal',
            'code' => 'SEN',
            'phone_code' => '+221',
            'currency_code' => 'XOF',
        ])->assertStatus(201)->json();

        $created = $this->postJson('/api/cities', [
            'country_id' => $senegal['id'],
            'name' => 'Thiès',
        ])->assertStatus(201)->assertJsonPath('name', 'Thiès')->json();

        $this->assertDatabaseHas('cities', ['name' => 'Thiès', 'country_id' => $senegal['id']]);

        $this->getJson('/api/cities?country_id='.$senegal['id'])
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/cities?country_id='.Country::where('code', 'CMR')->value('id'))
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->putJson('/api/cities/'.$created['id'], ['name' => 'Thiès Ville'])
            ->assertOk()
            ->assertJsonPath('name', 'Thiès Ville');

        $this->deleteJson('/api/cities/'.$created['id'])->assertStatus(204);
        $this->assertDatabaseMissing('cities', ['id' => $created['id']]);
    }

    public function test_city_name_must_be_unique_per_country(): void
    {
        $this->admin();

        $cmr = Country::where('code', 'CMR')->firstOrFail();

        $this->postJson('/api/cities', [
            'country_id' => $cmr->id,
            'name' => 'Douala',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Cette ville existe déjà dans ce pays.');
    }

    public function test_city_with_agencies_cannot_be_deleted(): void
    {
        $this->admin();

        $douala = City::where('name', 'Douala')->firstOrFail();
        $this->agencyIn('CMR', 'Douala');

        $this->deleteJson('/api/cities/'.$douala->id)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Impossible de supprimer une ville qui possède encore des agences.');
    }

    // ─── Tableau de bord hiérarchique ────────────────────────────────────

    public function test_dashboard_group_level_breaks_down_by_country(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $abidjan = $this->agencyIn('CIV', 'Abidjan');

        $this->createInvoice(['agency_id' => $douala->id, 'advance' => 100000, 'payment_type' => 'cash']);
        $this->createInvoice([
            'agency_id' => $abidjan->id,
            'items' => [['label' => 'Formation', 'unit_price' => 50000, 'quantity' => 1]],
            'advance' => 50000,
            'payment_type' => 'cash',
        ]);

        $dashboard = $this->getJson('/api/dashboard')->assertOk()->json();

        $this->assertSame('organization', $dashboard['scope']['type']);
        $this->assertSame('PEKEGNO Group', $dashboard['scope']['breadcrumb'][0]['name']);
        $this->assertEquals(150000, $dashboard['kpis']['revenue']);
        $this->assertEquals(2, $dashboard['kpis']['agencies_total']);
        $this->assertCount(2, $dashboard['navigation']['countries']);

        $cmr = collect($dashboard['navigation']['countries'])->firstWhere('code', 'CMR');
        $civ = collect($dashboard['navigation']['countries'])->firstWhere('code', 'CIV');

        $this->assertSame('Cameroun', $cmr['name']);
        $this->assertEquals(100000, $cmr['revenue']);
        $this->assertEquals(1, $cmr['invoices_total']);
        $this->assertEquals(1, $cmr['agencies_total']);
        $this->assertEquals(50000, $civ['revenue']);
    }

    public function test_dashboard_drills_down_to_city_and_agency_levels(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $yaounde = $this->agencyIn('CMR', 'Yaoundé');

        $this->createInvoice(['agency_id' => $douala->id, 'advance' => 100000, 'payment_type' => 'cash']);
        $this->createInvoice(['agency_id' => $yaounde->id, 'advance' => 100000, 'payment_type' => 'cash']);

        $cmr = Country::where('code', 'CMR')->firstOrFail();

        $countryView = $this->getJson('/api/dashboard?country_id='.$cmr->id)->assertOk()->json();

        $this->assertSame('country', $countryView['scope']['type']);
        $this->assertCount(2, $countryView['scope']['breadcrumb']);
        $this->assertCount(2, $countryView['navigation']['cities']);
        $this->assertEquals(200000, $countryView['kpis']['revenue']);

        $cityView = $this->getJson('/api/dashboard?city_id='.$douala->city_id)->assertOk()->json();

        $this->assertSame('city', $cityView['scope']['type']);
        $this->assertCount(1, $cityView['navigation']['agencies']);
        $this->assertEquals(100000, $cityView['navigation']['agencies'][0]['revenue']);

        $agencyView = $this->getJson('/api/dashboard?agency_id='.$douala->id)->assertOk()->json();

        $this->assertSame('agency', $agencyView['scope']['type']);
        $this->assertCount(4, $agencyView['scope']['breadcrumb']);
        $this->assertSame('Agence Douala', $agencyView['scope']['breadcrumb'][3]['name']);
        $this->assertEquals(100000, $agencyView['kpis']['revenue']);
        $this->assertEquals(1, $agencyView['kpis']['agencies_total']);
    }

    // ─── Application du périmètre (backend) ──────────────────────────────

    public function test_agency_chief_scope_is_enforced_on_dashboard(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $abidjan = $this->agencyIn('CIV', 'Abidjan');

        $this->createInvoice(['agency_id' => $douala->id, 'advance' => 100000, 'payment_type' => 'cash']);
        $this->createInvoice(['agency_id' => $abidjan->id, 'advance' => 50000, 'payment_type' => 'cash']);

        $this->chief('responsable-agence', $douala);

        $dashboard = $this->getJson('/api/dashboard')->assertOk()->json();

        $this->assertEquals(100000, $dashboard['kpis']['revenue']);
        $this->assertEquals(1, $dashboard['kpis']['agencies_total']);
        $this->assertCount(1, $dashboard['navigation']['countries']);
        $this->assertSame('CMR', $dashboard['navigation']['countries'][0]['code']);

        $this->getJson('/api/dashboard?agency_id='.$abidjan->id)->assertForbidden();
        $this->getJson('/api/dashboard?country_id='.Country::where('code', 'CIV')->value('id'))->assertForbidden();
    }

    public function test_scope_context_is_restricted_for_assigned_users(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $this->agencyIn('CIV', 'Abidjan');

        $global = $this->getJson('/api/scope/context')->assertOk()->json();

        $this->assertTrue($global['user']['is_global']);
        $this->assertCount(2, $global['countries']);
        $this->assertSame(5, collect($global['countries'])->sum('cities_count'));
        $this->assertSame(2, collect($global['countries'])->sum(fn ($c) => count($c['agencies'])));

        $this->chief('responsable-agence', $douala);

        $restricted = $this->getJson('/api/scope/context')->assertOk()->json();

        $this->assertFalse($restricted['user']['is_global']);
        $this->assertCount(1, $restricted['countries']);
        $this->assertSame('Cameroun', $restricted['countries'][0]['name']);
        $this->assertSame(1, collect($restricted['countries'])->sum(fn ($c) => count($c['agencies'])));
        $this->assertSame('Agence Douala', $restricted['countries'][0]['agencies'][0]['name']);
    }

    public function test_agencies_index_and_stats_are_scoped(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR', 'Douala');
        $this->agencyIn('CIV', 'Abidjan');

        $this->createInvoice(['agency_id' => $douala->id, 'advance' => 100000, 'payment_type' => 'cash']);

        $this->chief('responsable-agence', $douala);

        $this->getJson('/api/agencies')->assertOk()->assertJsonCount(1, 'data');

        $overview = $this->getJson('/api/stats/overview')->assertOk()->json();

        $this->assertEquals(100000, $overview['revenue']);
        $this->assertEquals(1, $overview['agencies_total']);

        $this->getJson('/api/bilans')->assertOk();
        $this->getJson('/api/bilans?agency_id='.Agency::where('name', 'Agence Abidjan')->value('id'))->assertForbidden();
        $this->getJson('/api/stats/agency/'.Agency::where('name', 'Agence Abidjan')->value('id'))->assertForbidden();
    }
}
