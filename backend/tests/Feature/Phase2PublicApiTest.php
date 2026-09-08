<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AgencyPaymentMethod;
use App\Models\Category;
use App\Models\City;
use App\Models\Country;
use App\Models\Product;
use App\Models\Service;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * API publique du site client (aucune authentification) — Phase 2 du plan.
 * Contrat consommé par frontend_client/src/api/public.api.ts.
 */
class Phase2PublicApiTest extends TestCase
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

    private function agencyIn(string $countryCode): Agency
    {
        $country = Country::where('code', $countryCode)->firstOrFail();
        $city = City::where('country_id', $country->id)->firstOrFail();

        return Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => "Agence {$country->code} {$city->name}",
            'type' => 'agency',
            'organization_id' => $country->organization_id,
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
        ]);
    }

    private function publicService(string $slug, array $overrides = []): Service
    {
        return Service::factory()->create(array_merge([
            'is_public' => true,
            'slug' => $slug,
            'price' => 25000,
        ], $overrides));
    }

    // ─── Pays ─────────────────────────────────────────────────────────────

    public function test_public_countries_are_listed_without_auth(): void
    {
        $countries = $this->getJson('/api/public/countries')->assertOk()->assertJsonCount(2)->json();

        $this->assertSame('Cameroun', $countries[0]['name']);
        $this->assertSame('CMR', $countries[0]['code']);
        $this->assertSame('CM', $countries[0]['iso_code']);
        $this->assertSame('+237', $countries[0]['phone_code']);
        $this->assertSame('XAF', $countries[0]['currency_code']);
        $this->assertIsInt($countries[0]['agencies_count']);

        // La liste ne contient pas de champ sensible ni de clé étrangère brute côté client.
        $this->assertArrayNotHasKey('organization_id', $countries[0]);
    }

    // ─── Agences ───────────────────────────────────────────────────────────

    public function test_public_agencies_are_listed_and_filterable_by_country(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $all = $this->getJson('/api/public/agencies')->assertOk()->assertJsonCount(2)->json();
        $names = collect($all)->pluck('id');
        $this->assertContains($cmr->id, $names);
        $this->assertContains($civ->id, $names);
        $this->assertArrayHasKey('payment_methods_count', $all[0]);

        $filtered = $this->getJson('/api/public/agencies?country_id='.$cmr->country_id)->assertOk()->json();
        $this->assertCount(1, $filtered);
        $this->assertSame($cmr->id, $filtered[0]['id']);

        // L'agence expose une dénomination `country` (pas country_id) pour l'affichage client.
        $this->assertSame('Cameroun', $filtered[0]['country']);
        $this->assertArrayNotHasKey('country_id', $filtered[0]);
    }

    // ─── Services ──────────────────────────────────────────────────────────

    public function test_public_services_include_only_public_with_global_and_agency(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');
        $category = Category::factory()->create(['name' => 'Conseil']);

        $global = $this->publicService('conseil-global', ['agency_id' => null, 'category_id' => $category->id]);
        $cmrService = $this->publicService('conseil-cmr', ['agency_id' => $cmr->id, 'category_id' => $category->id]);
        $civService = $this->publicService('conseil-civ', ['agency_id' => $civ->id, 'category_id' => $category->id]);
        $this->publicService('conseil-prive', ['agency_id' => null, 'is_public' => false]);

        $list = $this->getJson('/api/public/services')->assertOk()->json();
        $this->assertCount(3, $list);

        $filtered = $this->getJson('/api/public/services?agency_id='.$cmr->id)->assertOk()->json();
        $this->assertCount(2, $filtered);
        $names = collect($filtered)->pluck('name');
        $this->assertContains($global->name, $names);
        $this->assertContains($cmrService->name, $names);
        $this->assertNotContains($civService->name, $names);

        $countryFiltered = $this->getJson('/api/public/services?country_id='.$civ->country_id)->assertOk()->json();
        $names = collect($countryFiltered)->pluck('name');
        $this->assertContains($civService->name, $names);
        $this->assertNotContains($cmrService->name, $names);

        // Contrat prix : chaîne de caractères à 2 décimales, prix effectif, catégorie embarquée.
        $first = $list[0];
        $this->assertSame('25000.00', $first['price']);
        $this->assertSame('25000.00', $first['effective_price']);
        $this->assertSame('Conseil', $first['category']['name']);
        $this->assertArrayHasKey('slug', $first);
    }

    public function test_public_service_detail_by_slug_and_by_id(): void
    {
        $service = $this->publicService('formation-excel', ['is_seminar' => false]);

        $bySlug = $this->getJson('/api/public/services/formation-excel')->assertOk()->json();
        $this->assertSame($service->id, $bySlug['id']);
        $this->assertArrayHasKey('promotions', $bySlug);
        $this->assertArrayHasKey('presentation_video', $bySlug);

        $byId = $this->getJson('/api/public/services/'.$service->id)->assertOk()->json();
        $this->assertSame($service->id, $byId['id']);

        $this->getJson('/api/public/services/formation-introuvable')->assertNotFound();
    }

    public function test_public_service_detail_hides_non_public_services(): void
    {
        $service = Service::factory()->create(['is_public' => false, 'slug' => 'service-cache']);

        $this->getJson('/api/public/services/service-cache')->assertNotFound();
        $this->getJson('/api/public/services/'.$service->id)->assertNotFound();
    }

    // ─── Produits ──────────────────────────────────────────────────────────

    public function test_public_products_include_only_public(): void
    {
        $this->publicProduct();
        $this->publicProduct([
            'slug' => 'produit-cache',
            'is_public' => false,
        ]);

        $list = $this->getJson('/api/public/products')->assertOk()->assertJsonCount(1)->json();

        // Contrat produit : prix TTC et HT en chaîne à 2 décimales, marque renseignée.
        $product = $list[0];
        $this->assertSame('15000.00', $product['selling_price']);
        $this->assertSame('17887.5', $product['price_with_tax']);
        $this->assertSame('PEKEGNO', $product['brand']);
        $this->assertSame('19.25', $product['tax_rate']);
    }

    public function test_public_product_detail_by_slug_and_id(): void
    {
        $product = $this->publicProduct(['slug' => 'guide-comptable']);

        $bySlug = $this->getJson('/api/public/products/guide-comptable')->assertOk()->json();
        $this->assertSame($product->id, $bySlug['id']);

        $byId = $this->getJson('/api/public/products/'.$product->id)->assertOk()->json();
        $this->assertSame($product->id, $byId['id']);

        $this->getJson('/api/public/products/guide-introuvable')->assertNotFound();
        $this->getJson('/api/public/products/'.$this->publicProduct(['slug' => 'produit-cache', 'is_public' => false])->id)->assertNotFound();
    }

    public function test_public_products_are_filterable_by_agency(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $global = $this->publicProduct(['slug' => 'produit-global']);
        $cmrProduct = $this->publicProduct(['slug' => 'produit-cmr', 'agency_id' => $cmr->id]);
        $civProduct = $this->publicProduct(['slug' => 'produit-civ', 'agency_id' => $civ->id]);

        $filtered = $this->getJson('/api/public/products?agency_id='.$cmr->id)->assertOk()->json();
        $this->assertCount(2, $filtered);
        $names = collect($filtered)->pluck('name');
        $this->assertContains($global->name, $names);
        $this->assertContains($cmrProduct->name, $names);
        $this->assertNotContains($civProduct->name, $names);
    }

    // ─── Moyens de paiement d'une agence ───────────────────────────────────

    public function test_public_agency_payment_methods_return_only_active(): void
    {
        $agency = $this->agencyIn('CMR');

        AgencyPaymentMethod::create([
            'agency_id' => $agency->id,
            'provider' => 'om',
            'phone_number' => '+237690000001',
            'account_holder' => 'PEKEGNO Douala',
            'instructions' => 'Envoyez puis soumettez la preuve',
            'is_active' => true,
        ]);
        AgencyPaymentMethod::create([
            'agency_id' => $agency->id,
            'provider' => 'momo',
            'phone_number' => '+237680000002',
            'account_holder' => 'PEKEGNO Douala',
            'is_active' => true,
        ]);
        AgencyPaymentMethod::create([
            'agency_id' => $agency->id,
            'provider' => 'mobile',
            'phone_number' => '+237670000003',
            'is_active' => false,
        ]);

        $methods = $this->getJson('/api/public/agencies/'.$agency->id.'/payment-methods')->assertOk()->json();
        $this->assertCount(2, $methods);
        $this->assertSame('om', $methods[0]['provider']);
        $this->assertSame('+237690000001', $methods[0]['phone_number']);
        $this->assertSame('Envoyez puis soumettez la preuve', $methods[0]['instructions']);
    }

    private function publicProduct(array $overrides = []): Product
    {
        return Product::factory()->create(array_merge([
            'is_public' => true,
            'slug' => 'produit-'.Str::lower(Str::random(6)),
            'selling_price' => 15000,
            'tax_rate' => 19.25,
            'brand' => 'PEKEGNO',
        ], $overrides));
    }
}