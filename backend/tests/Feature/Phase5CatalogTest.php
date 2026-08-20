<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Category;
use App\Models\City;
use App\Models\Country;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase5CatalogTest extends TestCase
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
        $city = City::whereIn('country_id', [$country->id])->firstOrFail();

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

    private function createProduct(array $overrides = []): array
    {
        return $this->postJson('/api/products', array_merge([
            'name' => 'Livre PEKEGNO',
            'selling_price' => 15000,
        ], $overrides))->assertStatus(201)->json();
    }

    // ─── CRUD produits ───────────────────────────────────────────────────

    public function test_admin_can_crud_product(): void
    {
        $this->admin();

        $category = Category::factory()->create(['name' => 'Boutique']);

        $created = $this->createProduct([
            'sku' => 'PRD-AMAZING',
            'category_id' => $category->id,
            'brand' => 'PEKEGNO',
            'purchase_price' => 8000,
            'tax_rate' => 19.25,
            'is_stock_managed' => true,
        ]);

        $this->assertSame('PRD-AMAZING', $created['sku']);
        $this->assertSame('Livre PEKEGNO', $created['name']);
        $this->assertSame('Boutique', $created['category']['name']);
        $this->assertEquals(15000, $created['selling_price']);
        $this->assertEquals(17887.5, $created['price_with_tax']);
        $this->assertTrue($created['is_stock_managed']);
        $this->assertSame('global', $created['availability']);
        $this->assertDatabaseHas('products', ['sku' => $created['sku'], 'brand' => 'PEKEGNO']);

        $this->getJson('/api/products?search=Livre')->assertOk()->assertJsonCount(1, 'data');

        $this->getJson('/api/products/'.$created['id'])->assertOk()->assertJsonPath('name', 'Livre PEKEGNO');

        $updated = $this->putJson('/api/products/'.$created['id'], [
            'name' => 'Livre Édition 2026',
            'selling_price' => 18000,
        ])->assertOk()->json();
        $this->assertSame('Livre Édition 2026', $updated['name']);
        $this->assertEquals(18000, $updated['selling_price']);

        $this->deleteJson('/api/products/'.$created['id'])->assertStatus(204);
        $this->assertSoftDeleted('products', ['id' => $created['id']]);

        $this->getJson('/api/products/trash')->assertOk()->assertJsonCount(1, 'data');

        $this->postJson('/api/products/'.$created['id'].'/restore')->assertOk();
        $this->assertDatabaseHas('products', ['id' => $created['id'], 'deleted_at' => null]);

        $this->deleteJson('/api/products/'.$created['id'])->assertStatus(204);
        $this->deleteJson('/api/products/'.$created['id'].'/force-delete')->assertStatus(204);
        $this->assertDatabaseMissing('products', ['id' => $created['id']]);
    }

    public function test_product_generates_sku_when_absent(): void
    {
        $this->admin();

        $first = $this->createProduct();
        $second = $this->createProduct();

        $this->assertSame('PRD-00001', $first['sku']);
        $this->assertSame('PRD-00002', $second['sku']);
    }

    public function test_product_sku_must_be_unique(): void
    {
        $this->admin();

        $this->postJson('/api/products', [
            'name' => 'Produit A',
            'sku' => 'PRD-00001',
            'selling_price' => 5000,
        ])->assertStatus(201);

        $this->postJson('/api/products', [
            'name' => 'Produit B',
            'sku' => 'PRD-00001',
            'selling_price' => 5000,
        ])->assertStatus(422)->assertJsonValidationErrors(['sku']);
    }

    public function test_product_requires_name_and_selling_price(): void
    {
        $this->admin();

        $this->postJson('/api/products', ['name' => 'X'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['selling_price']);

        $this->postJson('/api/products', ['selling_price' => 1000])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    // ─── Disponibilité par agence (§10, §12) ─────────────────────────────

    public function test_product_availability_filter_includes_global_products(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR');
        $abidjan = $this->agencyIn('CIV');

        $this->createProduct(['name' => 'Produit Global']);
        $this->createProduct(['name' => 'Produit Douala', 'agency_id' => $douala->id]);
        $this->createProduct(['name' => 'Produit Abidjan', 'agency_id' => $abidjan->id]);

        $list = $this->getJson('/api/products?agency_id='.$douala->id)->assertOk()->json();

        $this->assertCount(2, $list['data']);
        $names = collect($list['data'])->pluck('name');
        $this->assertContains('Produit Global', $names);
        $this->assertContains('Produit Douala', $names);
        $this->assertNotContains('Produit Abidjan', $names);

        $search = $this->getJson('/api/products/search?q=Produit&agency_id='.$abidjan->id)->assertOk()->json();
        $this->assertCount(2, $search);
    }

    public function test_catalog_scope_is_enforced_for_assigned_user(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR');
        $abidjan = $this->agencyIn('CIV');

        $this->createProduct(['name' => 'Global Visible']);
        $this->createProduct(['name' => 'Douala Visible', 'agency_id' => $douala->id]);
        $this->createProduct(['name' => 'Abidjan Cache', 'agency_id' => $abidjan->id]);

        $this->chief($douala);

        $list = $this->getJson('/api/products')->assertOk()->json();

        $this->assertCount(2, $list['data']);
        $names = collect($list['data'])->pluck('name');
        $this->assertContains('Global Visible', $names);
        $this->assertContains('Douala Visible', $names);
        $this->assertNotContains('Abidjan Cache', $names);
    }

    public function test_products_are_scoped_in_trash(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR');
        $abidjan = $this->agencyIn('CIV');

        $this->createProduct(['name' => 'A supprimer', 'agency_id' => $douala->id]);
        $other = $this->createProduct(['name' => 'Autre agence', 'agency_id' => $abidjan->id]);

        $this->deleteJson('/api/products/'.$other['id'])->assertStatus(204);

        $this->chief($douala);

        $this->getJson('/api/products/trash')->assertOk()->assertJsonCount(0, 'data');
    }

    // ─── Permissions ─────────────────────────────────────────────────────

    public function test_products_require_creation_permission(): void
    {
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Sanctum::actingAs($commercial);

        $this->getJson('/api/products')->assertOk();
        $this->postJson('/api/products', ['name' => 'X', 'selling_price' => 1000])->assertForbidden();
        $this->putJson('/api/products/'.Product::factory()->create()->id, ['name' => 'Y'])->assertForbidden();
    }

    // ─── Codes services (spec §13) ───────────────────────────────────────

    public function test_service_code_is_auto_generated(): void
    {
        $this->admin();

        $category = Category::factory()->create();
        $agency = $this->agencyIn('CMR');

        $payload = ['category_id' => $category->id, 'agency_id' => $agency->id, 'name' => 'Conseil', 'price' => 50000];

        $first = $this->postJson('/api/services', $payload)->assertStatus(201)->json();
        $second = $this->postJson('/api/services', $payload)->assertStatus(201)->json();

        $this->assertSame('SRV-00001', $first['code']);
        $this->assertSame('SRV-00002', $second['code']);
    }

    public function test_duplicate_service_code_is_rejected(): void
    {
        $this->admin();

        $category = Category::factory()->create();
        $agency = $this->agencyIn('CMR');

        $this->postJson('/api/services', [
            'category_id' => $category->id,
            'agency_id' => $agency->id,
            'name' => 'Service A',
            'price' => 10000,
            'code' => 'SRV-CUSTOM',
        ])->assertStatus(201);

        $this->postJson('/api/services', [
            'category_id' => $category->id,
            'agency_id' => $agency->id,
            'name' => 'Service B',
            'price' => 10000,
            'code' => 'SRV-CUSTOM',
        ])->assertStatus(422)->assertJsonValidationErrors(['code']);
    }

    public function test_service_availability_filter_includes_global_services(): void
    {
        $this->admin();

        $douala = $this->agencyIn('CMR');
        $abidjan = $this->agencyIn('CIV');
        $category = Category::factory()->create();

        Service::factory()->create([
            'category_id' => $category->id,
            'name' => 'Service Global',
            'agency_id' => null,
        ]);
        Service::factory()->create([
            'category_id' => $category->id,
            'name' => 'Service Douala',
            'agency_id' => $douala->id,
        ]);
        Service::factory()->create([
            'category_id' => $category->id,
            'name' => 'Service Abidjan',
            'agency_id' => $abidjan->id,
        ]);

        $list = $this->getJson('/api/services?agency_id='.$douala->id)->assertOk()->json();

        $names = collect($list['data'])->pluck('name');
        $this->assertContains('Service Global', $names);
        $this->assertContains('Service Douala', $names);
        $this->assertNotContains('Service Abidjan', $names);
    }
}