<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase6SubscriptionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createServices(int $count = 4, array $prices = []): array
    {
        $services = [];
        for ($i = 0; $i < $count; $i++) {
            $services[] = Service::factory()->create([
                'price' => $prices[$i] ?? 10000,
            ]);
        }

        return $services;
    }

    private function packPayload(array $services, array $prices = [], ?string $agencyId = null): array
    {
        return [
            'agency_id' => $agencyId,
            'name' => 'Pack Pro',
            'description' => 'Pack de 4 services',
            'services' => collect($services)->map(fn (Service $s, $i) => [
                'service_id' => $s->id,
                'price_per_month' => $prices[$i] ?? 5000,
            ])->all(),
        ];
    }

    private function createClient(): array
    {
        return $this->postJson('/api/clients', [
            'first_name' => 'Client',
            'last_name' => 'Abonné',
            'email' => 'abonne@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(201)->json();
    }

    private function createPack(): array
    {
        $services = $this->createServices();
        $agency = Agency::factory()->create();

        return $this->postJson('/api/subscription-packs', $this->packPayload($services, [], $agency->id))
            ->assertStatus(201)
            ->json();
    }

    public function test_pack_requires_exactly_four_distinct_services(): void
    {
        $this->actingAsAdmin();

        $services = $this->createServices();

        $this->postJson('/api/subscription-packs', $this->packPayload(array_slice($services, 0, 3)))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['services']);

        $this->postJson('/api/subscription-packs', $this->packPayload(array_merge($services, [$services[0]])))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['services']);

        $this->postJson('/api/subscription-packs', $this->packPayload(array_merge($services, [Service::factory()->create()])))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['services']);
    }

    public function test_pack_crud(): void
    {
        $this->actingAsAdmin();

        $pack = $this->createPack();

        $this->assertDatabaseHas('subscription_packs', ['id' => $pack['id'], 'name' => 'Pack Pro']);
        $this->assertDatabaseCount('subscription_pack_services', 4);

        $list = $this->getJson('/api/subscription-packs')->assertOk()->json();
        $this->assertCount(1, $list);
        $this->assertCount(4, $list[0]['pack_services']);

        $this->putJson("/api/subscription-packs/{$pack['id']}", [
            'name' => 'Pack Renommé',
            'services' => collect($this->createServices())->map(fn (Service $s, $i) => [
                'service_id' => $s->id,
                'price_per_month' => 6000 + $i,
            ])->all(),
        ])->assertOk();

        $this->assertDatabaseHas('subscription_packs', ['id' => $pack['id'], 'name' => 'Pack Renommé']);

        $this->deleteJson("/api/subscription-packs/{$pack['id']}")->assertStatus(204);
        $this->assertDatabaseMissing('subscription_packs', ['id' => $pack['id']]);
    }

    public function test_subscription_store_generates_invoice(): void
    {
        $this->actingAsAdmin();

        $pack = $this->createPack();
        $client = $this->createClient();

        $subscription = $this->postJson('/api/subscriptions', [
            'pack_id' => $pack['id'],
            'client_id' => $client['id'],
            'months' => 3,
        ])
            ->assertStatus(201)
            ->json();

        $this->assertEquals(20000, $subscription['price_per_month']);
        $this->assertEquals(60000, $subscription['total_price']);
        $this->assertSame(now()->startOfDay()->toISOString(), $subscription['start_date']);
        $this->assertSame(now()->addMonths(3)->startOfDay()->toISOString(), $subscription['end_date']);

        $invoice = $subscription['invoice'];
        $this->assertEquals(60000, $invoice['total_amount']);
        $this->assertSame('unpaid', $invoice['status']);
        $this->assertCount(4, $invoice['items']);
        $this->assertEquals(3, $invoice['items'][0]['quantity']);
        $this->assertEquals(15000, $invoice['items'][0]['line_total']);

        $this->assertDatabaseHas('subscriptions', ['id' => $subscription['id'], 'invoice_id' => $invoice['id']]);
    }

    public function test_subscription_store_with_advance_records_payment_and_accounting(): void
    {
        $this->actingAsAdmin();

        $pack = $this->createPack();
        $client = $this->createClient();

        $subscription = $this->postJson('/api/subscriptions', [
            'pack_id' => $pack['id'],
            'client_id' => $client['id'],
            'months' => 2,
            'advance' => 10000,
            'payment_type' => 'mobile',
        ])->assertStatus(201)->json();

        $invoice = $subscription['invoice'];
        $this->assertCount(1, $invoice['payments']);
        $this->assertEquals(10000, $invoice['payments'][0]['amount']);
        $this->assertSame('mobile', $invoice['payments'][0]['payment_method']);
        $this->assertSame('partial', $invoice['status']);

        $this->assertDatabaseHas('accounting_transactions', [
            'type' => 'income',
            'invoice_id' => $invoice['id'],
            'amount' => 10000,
        ]);
    }

    public function test_subscription_requires_client_role(): void
    {
        $this->actingAsAdmin();

        $pack = $this->createPack();
        $employee = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);

        $this->postJson('/api/subscriptions', [
            'pack_id' => $pack['id'],
            'client_id' => $employee->id,
            'months' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Le client lié doit avoir le rôle client.');
    }

    public function test_subscription_renew_creates_new_invoice_and_period(): void
    {
        $this->actingAsAdmin();

        $pack = $this->createPack();
        $client = $this->createClient();

        $subscription = $this->postJson('/api/subscriptions', [
            'pack_id' => $pack['id'],
            'client_id' => $client['id'],
            'months' => 2,
            'start_date' => '2026-09-01',
        ])->assertStatus(201)->json();

        $renewed = $this->postJson("/api/subscriptions/{$subscription['id']}/renew", [
            'advance' => 20000,
            'payment_type' => 'cash',
        ])->assertStatus(201)->json();

        $this->assertNotSame($subscription['id'], $renewed['id']);
        $this->assertNotSame($subscription['invoice']['id'], $renewed['invoice']['id']);
        $this->assertSame('2026-11-02T00:00:00.000000Z', $renewed['start_date']);
        $this->assertSame('2027-01-02T00:00:00.000000Z', $renewed['end_date']);
        $this->assertEquals(40000, $renewed['total_price']);
        $this->assertEquals(20000, $renewed['invoice']['amount_paid']);

        $this->assertDatabaseCount('subscriptions', 2);
        $this->assertSame(2, Subscription::query()->count());
    }

    public function test_subscription_index_filters(): void
    {
        $this->actingAsAdmin();

        $pack = $this->createPack();
        $client = $this->createClient();

        $subscription = $this->postJson('/api/subscriptions', [
            'pack_id' => $pack['id'],
            'client_id' => $client['id'],
            'months' => 1,
        ])->assertStatus(201)->json();

        $this->postJson("/api/invoices/{$subscription['invoice']['id']}/payments", [
            'amount' => 20000,
            'payment_method' => 'cash',
        ])->assertOk();

        $this->getJson('/api/subscriptions')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/subscriptions?status=paid')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/subscriptions?status=unpaid')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/subscriptions?client_id='.$client['id'])
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_subscription_permissions(): void
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        Sanctum::actingAs($client);

        $this->getJson('/api/subscriptions')->assertForbidden();
    }

    public function test_subscription_allowed_for_caissier(): void
    {
        $caissier = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        Sanctum::actingAs($caissier);

        $this->getJson('/api/subscriptions')->assertOk();
        $this->getJson('/api/subscription-packs')->assertOk();
    }
}
