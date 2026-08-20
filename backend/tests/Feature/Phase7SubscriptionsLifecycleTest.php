<?php

namespace Tests\Feature;

use App\Jobs\CheckSubscriptionExpiry;
use App\Models\Agency;
use App\Models\Role;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\SubscriptionNotification;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase7SubscriptionsLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private const PACK_PRICE = 20000;

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

    private function createServices(int $count = 4): array
    {
        $services = [];
        for ($i = 0; $i < $count; $i++) {
            $services[] = Service::factory()->create(['price' => 10000]);
        }

        return $services;
    }

    private function createPack(?Agency $agency = null): array
    {
        $agency ??= Agency::factory()->create();

        return $this->postJson('/api/subscription-packs', [
            'agency_id' => $agency->id,
            'name' => 'Pack Pro',
            'price_per_month' => self::PACK_PRICE,
            'services' => collect($this->createServices())->map(fn (Service $s, $i) => [
                'service_id' => $s->id,
                'price_per_month' => 5000 + $i,
            ])->all(),
        ])->assertStatus(201)->json();
    }

    private function createClient(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', 'client')->value('id'),
        ], $overrides));
    }

    private function createSubscription(array $overrides = []): array
    {
        $payload = array_merge([
            'subscription_pack_id' => $this->createPack()['id'],
            'client_id' => $this->createClient()->id,
            'months' => 2,
        ], $overrides);

        return $this->postJson('/api/subscriptions', $payload)->assertStatus(201)->json();
    }

    private function runJob(): void
    {
        (new CheckSubscriptionExpiry)->handle();
    }

    // ─── Cycle de vie ────────────────────────────────────────────────────

    public function test_customer_specific_price_overrides_pack_price(): void
    {
        $this->admin();
        $pack = $this->createPack();
        $client = $this->createClient();

        $subscription = $this->postJson('/api/subscriptions', [
            'subscription_pack_id' => $pack['id'],
            'client_id' => $client->id,
            'months' => 3,
            'price_per_month' => 25000,
        ])->assertStatus(201)->json();

        $this->assertEquals(25000, $subscription['price_per_month']);
        $this->assertEquals(75000, $subscription['total_price']);
        $this->assertEquals(75000, $subscription['invoice']['total_amount']);

        $this->assertDatabaseHas('subscription_packs', ['id' => $pack['id'], 'price_per_month' => self::PACK_PRICE]);
    }

    public function test_default_lifecycle_status_is_active_when_started_today(): void
    {
        $this->admin();
        $subscription = $this->createSubscription();

        $this->assertSame('active', $subscription['status']);
    }

    public function test_future_start_date_marks_pending(): void
    {
        $this->admin();
        $subscription = $this->createSubscription(['start_date' => now()->addMonth()->toDateString()]);

        $this->assertSame('pending', $subscription['status']);
        $this->assertNotNull($subscription['days_to_expiry']);
    }

    public function test_renew_marks_previous_subscription_renewed(): void
    {
        $this->admin();
        $subscription = $this->createSubscription();

        $renewed = $this->postJson("/api/subscriptions/{$subscription['id']}/renew", [])
            ->assertStatus(201)->json();

        $this->assertSame('renewed', $this->getJson("/api/subscriptions/{$subscription['id']}")->json()['status']);
        $this->assertSame('active', $renewed['status']);
    }

    public function test_cancel_sets_status_and_cancellation_date(): void
    {
        $this->admin();
        $subscription = $this->createSubscription();

        $this->postJson("/api/subscriptions/{$subscription['id']}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->assertDatabaseHas('subscriptions', [
            'id' => $subscription['id'],
            'status' => 'cancelled',
        ]);
        $this->assertNotNull(Subscription::find($subscription['id'])->cancelled_at);

        $this->postJson("/api/subscriptions/{$subscription['id']}/cancel")
            ->assertStatus(422);
    }

    public function test_expired_status_refreshed_on_read(): void
    {
        $this->admin();
        $subscription = $this->createSubscription(['start_date' => now()->subMonths(3)->toDateString()]);

        $this->assertSame('expired', $this->getJson("/api/subscriptions/{$subscription['id']}")->json()['status']);
        $this->assertLessThan(0, $this->getJson("/api/subscriptions/{$subscription['id']}")->json()['days_to_expiry']);
    }

    // ─── Filtres ────────────────────────────────────────────────────────

    public function test_index_filters_by_lifecycle_status_and_dates(): void
    {
        $this->admin();
        $this->createSubscription(['start_date' => now()->subMonth()->toDateString()]);
        $this->createSubscription(['start_date' => now()->subMonths(3)->toDateString()]);

        $this->getJson('/api/subscriptions?status=active')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/subscriptions?status=expired')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/subscriptions?from='.now()->subMonths(2)->toDateString())->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/subscriptions?to='.now()->subMonths(2)->toDateString())->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_index_filters_expiring_soon_and_is_expired(): void
    {
        $this->admin();

        $soon = $this->createSubscription(['start_date' => now()->subMonths(2)->addDays(20)->toDateString()]);
        $this->createSubscription(['start_date' => now()->subMonths(3)->toDateString()]);

        $this->getJson('/api/subscriptions?expiring_soon=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $soon['id']);

        $this->getJson('/api/subscriptions?is_expired=1')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_index_filters_by_country_city_and_commercial(): void
    {
        $this->admin();
        $country = \App\Models\Country::where('code', 'CMR')->firstOrFail();
        $city = \App\Models\City::where('country_id', $country->id)->firstOrFail();
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $inScoped = $this->createSubscription([
            'client_id' => $this->createClient([
                'country_id' => $country->id,
                'city_id' => $city->id,
                'commercial_user_id' => $commercial->id,
            ])->id,
        ]);
        $this->createSubscription(['start_date' => now()->subMonths(3)->toDateString()]);

        $this->getJson('/api/subscriptions?country_id='.$country->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $inScoped['id']);
        $this->getJson('/api/subscriptions?city_id='.$city->id)
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/subscriptions?commercial_id='.$commercial->id)
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_invoice_status_filters_still_work(): void
    {
        $this->admin();
        $subscription = $this->createSubscription();

        $this->postJson("/api/invoices/{$subscription['invoice']['id']}/payments", [
            'amount' => $subscription['total_price'],
            'payment_method' => 'cash',
        ])->assertOk();

        $this->getJson('/api/subscriptions?status=paid')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/subscriptions?status=unpaid')->assertOk()->assertJsonCount(0, 'data');
    }

    // ─── Moteur de notifications ────────────────────────────────────────

    public function test_job_creates_idempotent_reminders(): void
    {
        $this->admin();
        $pack = $this->createPack();

        $insert = fn (int $endOffset) => $this->postJson('/api/subscriptions', [
            'subscription_pack_id' => $pack['id'],
            'client_id' => $this->createClient()->id,
            'months' => 2,
            'start_date' => today()->addDays($endOffset)->subMonths(2)->toDateString(),
        ])->assertStatus(201);

        $insert(14);
        $insert(7);
        $insert(1);
        $insert(0);

        $this->runJob();
        $this->runJob();

        $this->assertDatabaseCount('subscription_notifications', 4);
        $this->assertSame(0, SubscriptionNotification::where('status', 'pending')->count());
        $this->assertSame(4, SubscriptionNotification::where('status', 'sent')->count());
        $this->assertSame(1, SubscriptionNotification::where('notification_type', '14_days')->count());
        $this->assertSame(1, SubscriptionNotification::where('notification_type', '7_days')->count());
        $this->assertSame(1, SubscriptionNotification::where('notification_type', '1_day')->count());
        $this->assertSame(1, SubscriptionNotification::where('notification_type', 'expired')->count());
        $this->assertSame(4, SubscriptionNotification::sum('attempt_count'));
    }

    public function test_job_expires_past_subscriptions(): void
    {
        $this->admin();
        $pack = $this->createPack();

        $subscription = $this->postJson('/api/subscriptions', [
            'subscription_pack_id' => $pack['id'],
            'client_id' => $this->createClient()->id,
            'months' => 2,
            'start_date' => today()->subMonths(3)->toDateString(),
        ])->assertStatus(201)->json();

        $this->runJob();

        $this->assertDatabaseHas('subscriptions', ['id' => $subscription['id'], 'status' => 'expired']);
        $this->assertDatabaseCount('subscription_notifications', 0);
    }

    public function test_job_skips_cancelled_subscriptions(): void
    {
        $this->admin();
        $pack = $this->createPack();

        $subscription = $this->postJson('/api/subscriptions', [
            'subscription_pack_id' => $pack['id'],
            'client_id' => $this->createClient()->id,
            'months' => 2,
            'start_date' => today()->addDays(14)->subMonths(2)->toDateString(),
        ])->assertStatus(201)->json();

        $this->postJson("/api/subscriptions/{$subscription['id']}/cancel")->assertOk();

        $this->runJob();

        $this->assertDatabaseCount('subscription_notifications', 0);
    }

    // ─── Historique ─────────────────────────────────────────────────────

    public function test_notification_history_endpoints(): void
    {
        $this->admin();
        $pack = $this->createPack();

        $subscription = $this->postJson('/api/subscriptions', [
            'subscription_pack_id' => $pack['id'],
            'client_id' => $this->createClient()->id,
            'months' => 2,
            'start_date' => today()->addDays(14)->subMonths(2)->toDateString(),
        ])->assertStatus(201)->json();

        $this->runJob();

        $notification = SubscriptionNotification::firstOrFail();

        $this->getJson('/api/subscription-notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.notification_type', '14_days');

        $this->getJson('/api/subscription-notifications?status=sent&type=14_days')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/subscription-notifications?subscription_id='.$subscription['id'])
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->postJson("/api/subscription-notifications/{$notification->id}/retry")
            ->assertOk()
            ->assertJsonPath('attempt_count', 2)
            ->assertJsonPath('status', 'sent');
    }

    public function test_notifications_require_permission(): void
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        Sanctum::actingAs($client);

        $this->getJson('/api/subscription-notifications')->assertForbidden();
    }
}