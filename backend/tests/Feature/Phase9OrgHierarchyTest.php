<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\City;
use App\Models\ClientCategory;
use App\Models\Country;
use App\Models\Organization;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\AgencySeeder;
use Database\Seeders\CitySeeder;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Phase9OrgHierarchyTest extends TestCase
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

    public function test_organization_is_seeded(): void
    {
        $organization = Organization::where('code', 'PEKEGNO')->first();

        $this->assertNotNull($organization);
        $this->assertSame('PEKEGNO Group', $organization->name);
        $this->assertTrue($organization->is_active);
    }

    public function test_countries_are_seeded_with_currencies(): void
    {
        $cmr = Country::where('code', 'CMR')->first();
        $civ = Country::where('code', 'CIV')->first();

        $this->assertNotNull($cmr);
        $this->assertNotNull($civ);
        $this->assertSame('Cameroun', $cmr->name);
        $this->assertSame('XAF', $cmr->currency_code);
        $this->assertSame('+237', $cmr->phone_code);
        $this->assertSame('XOF', $civ->currency_code);
        $this->assertSame('+225', $civ->phone_code);
        $this->assertTrue($cmr->organization->is(Organization::where('code', 'PEKEGNO')->first()));
        $this->assertSame(2, Country::count());
    }

    public function test_cities_are_seeded_and_linked_to_countries(): void
    {
        $cmr = Country::where('code', 'CMR')->first();
        $civ = Country::where('code', 'CIV')->first();

        $this->assertSame(['Bamenda', 'Douala', 'Yaoundé'], $cmr->cities()->pluck('name')->sort()->values()->all());
        $this->assertSame(['Abidjan', 'Bouaké'], $civ->cities()->pluck('name')->sort()->values()->all());

        $douala = City::where('name', 'Douala')->first();
        $this->assertTrue($douala->country->is($cmr));
        $this->assertSame(5, City::count());
    }

    public function test_city_name_is_unique_per_country(): void
    {
        $cmr = Country::where('code', 'CMR')->first();

        $this->expectException(\Illuminate\Database\QueryException::class);
        City::create(['country_id' => $cmr->id, 'name' => 'Douala']);
    }

    public function test_client_categories_are_seeded(): void
    {
        $slugs = ClientCategory::pluck('slug')->sort()->values()->all();

        $this->assertSame(['abonne', 'apprenant', 'autre', 'prospect'], $slugs);
    }

    public function test_agency_belongs_to_organization_country_city_and_type_defaults(): void
    {
        $this->seed(AgencySeeder::class);

        $agency = Agency::where('code', 'AG001')->first();

        $this->assertNotNull($agency);
        $this->assertSame('agency', $agency->type);
        $this->assertTrue($agency->isAgency());
        $this->assertFalse($agency->isAcademy());
        $this->assertNotNull($agency->organization_id);
        $this->assertTrue($agency->organization->is(Organization::where('code', 'PEKEGNO')->first()));
        $this->assertSame('CMR', $agency->geoCountry->code);
        $this->assertSame('Douala', $agency->geoCity->name);
    }

    public function test_agency_can_be_created_with_academy_and_mixed_types(): void
    {
        $cmr = Country::where('code', 'CMR')->first();
        $yaounde = City::where('name', 'Yaoundé')->first();

        $academy = Agency::create([
            'code' => 'AG900',
            'name' => 'Académie PEKEGNO Yaoundé',
            'type' => 'academy',
            'organization_id' => $cmr->organization_id,
            'country_id' => $cmr->id,
            'city_id' => $yaounde->id,
            'country' => 'Cameroun',
            'city' => 'Yaoundé',
        ]);

        $this->assertTrue($academy->isAcademy());
        $this->assertFalse($academy->isAgency());
        $this->assertTrue($academy->geoCity->is($yaounde));
        $this->assertTrue($academy->geoCountry->is($cmr));
    }

    public function test_user_belongs_to_client_category_country_and_city(): void
    {
        $category = ClientCategory::where('slug', 'apprenant')->first();
        $cmr = Country::where('code', 'CMR')->first();
        $douala = City::where('name', 'Douala')->first();

        $user = User::factory()->create([
            'client_category_id' => $category->id,
            'country_id' => $cmr->id,
            'city_id' => $douala->id,
        ]);

        $this->assertTrue($user->clientCategory->is($category));
        $this->assertTrue($user->geoCountry->is($cmr));
        $this->assertTrue($user->geoCity->is($douala));
    }

    public function test_full_database_seeder_links_agencies_to_geo(): void
    {
        $this->artisan('db:seed');

        $agencies = Agency::with('geoCountry', 'geoCity')->get();

        $this->assertCount(3, $agencies);
        $expectedByCode = ['AG001' => 'CMR', 'AG002' => 'CMR', 'AG003' => 'CIV'];
        foreach ($agencies as $agency) {
            $this->assertNotNull($agency->geoCountry);
            $this->assertNotNull($agency->geoCity);
            $this->assertSame($expectedByCode[$agency->code], $agency->geoCountry->code);
        }
    }
}
