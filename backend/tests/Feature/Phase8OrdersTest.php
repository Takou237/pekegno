<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase8OrdersTest extends TestCase
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

    private function userWithRole(string $roleName): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
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

    private function createClient(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
    }

    private function createOrder(array $overrides = []): array
    {
        $service = Service::factory()->create(['price' => 10000]);

        return $this->postJson('/api/orders', array_merge([
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 2],
                ['line_type' => 'manual', 'label' => 'Gestion des pages', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ], $overrides))->assertStatus(201)->json();
    }

    public function test_order_crud_with_catalog_and_manual_lines(): void
    {
        $this->admin();
        $order = $this->createOrder();

        $this->assertMatchesRegularExpression('/^CMD-\d{8}-\d{3}$/', $order['number']);
        $this->assertCount(2, $order['lines']);
        $this->assertEquals(20000, $order['lines'][0]['line_total']);
        $this->assertEquals(15000, $order['lines'][1]['line_total']);
        $this->assertEquals(35000, $order['subtotal']);
        $this->assertEquals(35000, $order['total_amount']);
        $this->assertSame('draft', $order['status']);

        $this->getJson("/api/orders/{$order['id']}")->assertOk();

        $updated = $this->putJson("/api/orders/{$order['id']}", [
            'status' => 'confirmed',
            'discount' => 5000,
            'lines' => [
                ['line_type' => 'manual', 'label' => 'Ligne unique', 'unit_price' => 30000, 'quantity' => 1],
            ],
        ])->assertOk()->json();

        $this->assertCount(1, $updated['lines']);
        $this->assertEquals(25000, $updated['total_amount']);

        $this->deleteJson("/api/orders/{$order['id']}")->assertStatus(204);
        $this->assertSoftDeleted('orders', ['id' => $order['id']]);
    }

    public function test_multiple_occurrences_of_same_service_allowed(): void
    {
        $this->admin();
        $service = Service::factory()->create(['price' => 10000]);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 1],
                ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 3],
                ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 2],
            ],
        ])->assertStatus(201)->json();

        $this->assertCount(3, $order['lines']);
        $this->assertEquals(60000, $order['total_amount']);
    }

    public function test_price_snapshot_is_frozen(): void
    {
        $this->admin();
        $service = Service::factory()->create(['price' => 10000]);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $service->update(['price' => 25000]);

        $shown = $this->getJson("/api/orders/{$order['id']}")->json();
        $this->assertEquals(10000, $shown['lines'][0]['unit_price']);
        $this->assertEquals(10000, $shown['total_amount']);
    }

    public function test_catalog_line_price_override_is_snapshot(): void
    {
        $this->admin();
        $service = Service::factory()->create(['price' => 10000]);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $service->id, 'unit_price' => 12000, 'quantity' => 2],
            ],
        ])->assertStatus(201)->json();

        $this->assertEquals(12000, $order['lines'][0]['unit_price']);
        $this->assertEquals(24000, $order['total_amount']);
    }

    public function test_order_lifecycle_confirm_cancel(): void
    {
        $this->admin();
        $order = $this->createOrder();

        $this->postJson("/api/orders/{$order['id']}/confirm")
            ->assertOk()
            ->assertJsonPath('status', 'confirmed');

        $this->postJson("/api/orders/{$order['id']}/confirm")->assertStatus(422);

        $this->postJson("/api/orders/{$order['id']}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->postJson("/api/orders/{$order['id']}/cancel")->assertStatus(422);
    }

    public function test_invoice_generation_from_order(): void
    {
        $this->admin();
        $commercial = Commercial::factory()->create(['user_id' => $this->userWithRole('commercial')->id]);
        $order = $this->createOrder(['commercial_id' => $commercial->id]);

        $this->postJson("/api/orders/{$order['id']}/confirm")->assertOk();

        $invoice = $this->postJson("/api/orders/{$order['id']}/invoice")
            ->assertStatus(201)
            ->json();

        $this->assertCount(2, $invoice['items']);
        $this->assertEquals(35000, $invoice['total_amount']);
        $this->assertSame('unpaid', $invoice['status']);
        $this->assertEquals($commercial->id, $invoice['commercial']['id']);
        $this->assertEquals(10000, $invoice['items'][0]['unit_price']);

        $this->assertDatabaseHas('orders', [
            'id' => $order['id'],
            'status' => 'completed',
            'invoice_id' => $invoice['id'],
        ]);

        $this->postJson("/api/orders/{$order['id']}/invoice")->assertStatus(422);
    }

    public function test_cancelled_order_cannot_be_invoiced(): void
    {
        $this->admin();
        $order = $this->createOrder();

        $this->postJson("/api/orders/{$order['id']}/cancel")->assertOk();

        $this->postJson("/api/orders/{$order['id']}/invoice")->assertStatus(422);
    }

    public function test_completed_order_cannot_be_modified(): void
    {
        $this->admin();
        $order = $this->createOrder();

        $this->postJson("/api/orders/{$order['id']}/invoice")->assertStatus(201);

        $this->putJson("/api/orders/{$order['id']}", ['status' => 'confirmed'])->assertStatus(422);
    }

    public function test_index_filters_and_search(): void
    {
        $this->admin();
        $order = $this->createOrder();

        $this->getJson('/api/orders?status=draft')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/orders?status=confirmed')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/orders?search='.$order['number'])->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/orders?client_id='.$order['client_id'])->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_orders_are_scoped_to_agency_for_chief(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $this->admin();
        $this->createOrder(['agency_id' => $cmr->id]);
        $this->createOrder(['agency_id' => $civ->id]);

        $this->chief($cmr);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_orders_require_permission(): void
    {
        $this->userWithRole('client');

        $this->getJson('/api/orders')->assertForbidden();
        $this->postJson('/api/orders', ['client_id' => $this->createClient()->id, 'lines' => []])->assertForbidden();
    }

    public function test_commercial_can_create_orders(): void
    {
        $this->userWithRole('commercial');

        $order = $this->createOrder();
        $this->assertNotNull($order['id']);

        $this->getJson('/api/orders')->assertOk();
    }
}