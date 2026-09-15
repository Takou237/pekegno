<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Phase10CartTest extends TestCase
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
            ClientCategorySeeder::class,
        ]);
    }

    private function registerClient(array $attributes = []): array
    {
        return $this->postJson('/api/client/register', array_merge([
            'first_name' => 'Claire',
            'last_name' => 'Client',
            'email' => 'claire@example.com',
            'phone' => '+237690000000',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], $attributes))->assertStatus(201)->json();
    }

    private function authClient(string $email = 'claire@example.com'): string
    {
        $this->registerClient();
        return $this->postJson('/api/client/login', [
            'email' => $email,
            'password' => 'password123',
        ])->assertOk()->json()['token'];
    }

    private function publicService(array $attributes = []): Service
    {
        return Service::factory()->create(array_merge(['price' => 10000, 'is_public' => true], $attributes));
    }

    private function publicProduct(array $attributes = []): Product
    {
        return Product::factory()->create(array_merge(['selling_price' => 5000, 'is_public' => true, 'is_active' => true], $attributes));
    }

    public function test_client_gets_empty_cart_by_default(): void
    {
        $token = $this->authClient();

        $cart = $this->withToken($token)->getJson('/api/client/cart')->assertOk()->json();

        $this->assertArrayHasKey('id', $cart);
        $this->assertSame([], $cart['items']);
        $this->assertEquals(0, $cart['total']);
        $this->assertEquals(0, $cart['count']);
    }

    public function test_client_can_add_service_and_product_to_cart(): void
    {
        $token = $this->authClient();
        $service = $this->publicService(['price' => 10000, 'name' => 'Conseil RH']);
        $product = $this->publicProduct(['selling_price' => 5000, 'name' => 'Pack Documents']);

        $first = $this->withToken($token)->postJson('/api/client/cart/items', [
            'service_id' => $service->id,
            'quantity' => 2,
        ])->assertStatus(201)->json();

        $this->assertCount(1, $first['items']);
        $this->assertSame('service', $first['items'][0]['type']);
        $this->assertSame('Conseil RH', $first['items'][0]['name']);
        $this->assertEquals(10000, $first['items'][0]['effective_price']);
        $this->assertEquals(2, $first['items'][0]['quantity']);
        $this->assertEquals(20000, $first['items'][0]['line_total']);
        $this->assertTrue($first['items'][0]['available']);

        $second = $this->withToken($token)->postJson('/api/client/cart/items', [
            'product_id' => $product->id,
            'quantity' => 3,
        ])->assertStatus(201)->json();

        $this->assertCount(2, $second['items']);
        $this->assertEquals(35000, $second['total']);
        $this->assertEquals(5, $second['count']);

        $this->assertDatabaseHas('cart_items', ['service_id' => $service->id, 'quantity' => 2]);
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 3]);
    }

    public function test_adding_same_item_merges_quantity(): void
    {
        $token = $this->authClient();
        $service = $this->publicService();

        $this->withToken($token)->postJson('/api/client/cart/items', ['service_id' => $service->id, 'quantity' => 2])->assertStatus(201);
        $merged = $this->withToken($token)->postJson('/api/client/cart/items', ['service_id' => $service->id, 'quantity' => 3])->assertStatus(201)->json();

        $this->assertCount(1, $merged['items']);
        $this->assertEquals(5, $merged['items'][0]['quantity']);
        $this->assertEquals(50000, $merged['total']);
    }

    public function test_cart_item_with_non_public_service_is_marked_unavailable(): void
    {
        $token = $this->authClient();
        $service = Service::factory()->create(['price' => 10000, 'is_public' => false]);

        $cart = $this->withToken($token)->postJson('/api/client/cart/items', [
            'service_id' => $service->id,
            'quantity' => 1,
        ])->assertStatus(201)->json();

        $this->assertFalse($cart['items'][0]['available']);
        $this->assertSame('indisponible', $cart['items'][0]['reason']);
    }

    public function test_client_can_update_and_remove_cart_item(): void
    {
        $token = $this->authClient();
        $service = $this->publicService();
        $item = $this->withToken($token)->postJson('/api/client/cart/items', ['service_id' => $service->id, 'quantity' => 1])->assertStatus(201)->json('items.0');

        $updated = $this->withToken($token)->putJson("/api/client/cart/items/{$item['id']}", ['quantity' => 7])->assertOk()->json();
        $this->assertEquals(7, $updated['items'][0]['quantity']);

        $afterRemove = $this->withToken($token)->deleteJson("/api/client/cart/items/{$item['id']}")->assertOk()->json();
        $this->assertSame([], $afterRemove['items']);
    }

    public function test_client_cannot_touch_another_clients_cart_item(): void
    {
        $token = $this->authClient();
        $service = $this->publicService();
        $item = $this->withToken($token)->postJson('/api/client/cart/items', ['service_id' => $service->id, 'quantity' => 1])->assertStatus(201)->json('items.0');

        $this->registerClient(['email' => 'paul@example.com']);
        $paulToken = $this->postJson('/api/client/login', [
            'email' => 'paul@example.com',
            'password' => 'password123',
        ])->assertOk()->json()['token'];

        // Le guard Sanctum mémorise le premier utilisateur résolu dans un même
        // test PHPUnit : on le réinitialise pour que Paul soit bien authentifié.
        $this->app['auth']->forgetGuards();

        $this->withToken($paulToken)->putJson("/api/client/cart/items/{$item['id']}", ['quantity' => 9])->assertStatus(404);
        $this->withToken($paulToken)->deleteJson("/api/client/cart/items/{$item['id']}")->assertStatus(404);
    }

    public function test_client_can_clear_cart(): void
    {
        $token = $this->authClient();
        $service = $this->publicService();
        $this->withToken($token)->postJson('/api/client/cart/items', ['service_id' => $service->id, 'quantity' => 1])->assertStatus(201);

        $emptied = $this->withToken($token)->deleteJson('/api/client/cart')->assertOk()->json();
        $this->assertSame([], $emptied['items']);
        $this->assertNull($emptied['agency_id']);
    }

    public function test_client_can_sync_full_cart(): void
    {
        $token = $this->authClient();
        $service = $this->publicService(['name' => 'Conseil', 'price' => 10000]);
        $product = $this->publicProduct(['name' => 'Pack', 'selling_price' => 5000]);

        $synced = $this->withToken($token)->putJson('/api/client/cart', [
            'agency_id' => null,
            'items' => [
                ['service_id' => $service->id, 'quantity' => 2],
                ['product_id' => $product->id, 'quantity' => 3],
            ],
        ])->assertOk()->json();

        $this->assertCount(2, $synced['items']);
        $this->assertEquals(35000, $synced['total']);
        $this->assertEquals(5, $synced['count']);
    }

    public function test_checkout_uses_server_price_and_ignores_client_price_override(): void
    {
        $token = $this->authClient();
        $service = $this->publicService(['price' => 10000, 'name' => 'Conseil']);

        $result = $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => [
                    ['line_type' => 'catalog', 'service_id' => $service->id, 'unit_price' => 1, 'quantity' => 2],
                ],
            ])
            ->assertStatus(201)
            ->json();

        $this->assertEquals(20000, $result['order']['total_amount']);
        $this->assertEquals(20000, $result['invoice']['total_amount']);
        $this->assertEquals(10000, $result['order']['lines'][0]['unit_price']);
    }

    public function test_checkout_rejects_non_public_service(): void
    {
        $token = $this->authClient();
        $service = Service::factory()->create(['price' => 10000, 'is_public' => false]);

        $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => [
                    ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 1],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_cart_checkout_with_cart_subtotal_matches_invoice(): void
    {
        $token = $this->authClient();
        $service = $this->publicService(['price' => 10000]);
        $product = $this->publicProduct(['selling_price' => 5000]);

        $cart = $this->withToken($token)->putJson('/api/client/cart', [
            'items' => [
                ['service_id' => $service->id, 'quantity' => 2],
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ])->assertOk()->json();

        $this->assertEquals(25000, $cart['total']);

        $result = $this->withToken($token)
            ->postJson('/api/client/checkout', [
                'agency_id' => Agency::factory()->create()->id,
                'lines' => collect($cart['items'])->map(fn ($i) => [
                    'line_type' => 'catalog',
                    'service_id' => $i['service_id'],
                    'product_id' => $i['product_id'],
                    'quantity' => $i['quantity'],
                ])->values()->all(),
            ])
            ->assertStatus(201)
            ->json();

        $this->assertEquals(25000, $result['invoice']['total_amount']);
        $this->assertSame(Invoice::VALIDATION_PENDING, $result['invoice']['validation_status']);
    }
}