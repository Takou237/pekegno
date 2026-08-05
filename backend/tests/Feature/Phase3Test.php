<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase3Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function userWithRole(string $roleName): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);
    }

    private function actingAsAdmin(): User
    {
        $admin = $this->userWithRole('super-admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_register_creates_client_role_and_number(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'first_name' => 'Aline',
            'last_name' => 'Fotso',
            'email' => 'aline@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('user.client_number', 'CL-00001');
        $response->assertJsonPath('user.role.name', 'client');
        $this->assertDatabaseHas('users', ['email' => 'aline@example.com', 'client_number' => 'CL-00001']);
    }

    public function test_admin_can_create_and_list_clients(): void
    {
        $this->actingAsAdmin();

        $created = $this->postJson('/api/clients', [
            'first_name' => 'Brice',
            'last_name' => 'Ngo',
            'email' => 'brice@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $created->assertStatus(201);
        $created->assertJsonPath('email', 'brice@example.com');
        $created->assertJsonPath('role.name', 'client');

        $this->getJson('/api/clients')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.email', 'brice@example.com');
    }

    public function test_commercial_crud_and_points_adjustment(): void
    {
        $this->actingAsAdmin();

        $created = $this->postJson('/api/commercials', [
            'first_name' => 'Jean',
            'last_name' => 'Vendeur',
            'email' => 'jean@example.com',
            'commission_type' => 'percent',
            'commission_value' => 5,
        ]);

        $created->assertStatus(201);
        $commercialId = $created->json('id');
        $this->assertNotNull($commercialId);

        $points = $this->postJson("/api/commercials/{$commercialId}/points", ['points' => 10]);
        $points->assertOk();
        $this->assertDatabaseHas('commercials', ['id' => $commercialId, 'points_balance' => 10]);

        $this->getJson('/api/commercials/ranking')
            ->assertOk()
            ->assertJsonPath('0.id', $commercialId);
    }

    public function test_invoice_creation_with_advance_then_full_payment_awards_points_and_commission(): void
    {
        $this->actingAsAdmin();
        $client = $this->postJson('/api/clients', [
            'first_name' => 'Client',
            'last_name' => 'Test',
            'email' => 'client@example.com',
        ])->json();
        $commercial = $this->postJson('/api/commercials', [
            'first_name' => 'Point',
            'last_name' => 'Receiver',
            'email' => 'point@example.com',
            'commission_type' => 'percent',
            'commission_value' => 10,
        ])->json();

        $invoice = $this->postJson('/api/invoices', [
            'client_id' => $client['id'],
            'commercial_id' => $commercial['id'],
            'payment_type' => 'cash',
            'items' => [
                ['label' => 'Nettoyage', 'unit_price' => 10000, 'quantity' => 2],
            ],
            'advance' => 5000,
        ]);

        $invoice->assertStatus(201);
        $invoice->assertJsonPath('status', 'partial');
        $invoice->assertJsonPath('total_amount', '20000.00');
        $invoice->assertJsonPath('balance_due', 15000);
        $this->assertMatchesRegularExpression('/^PK-\d{8}-\d{3}$/', $invoice->json('number'));

        $paid = $this->postJson("/api/invoices/{$invoice->json('id')}/payments", ['amount' => 15000, 'payment_method' => 'cash']);
        $paid->assertOk();
        $paid->assertJsonPath('status', 'paid');
        $paid->assertJsonPath('balance_due', 0);

        $this->assertDatabaseHas('commercials', ['id' => $commercial['id'], 'points_balance' => 3]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice->json('id'), 'commission_amount' => 2000]);
        $this->assertDatabaseHas('commercial_points', [
            'commercial_id' => $commercial['id'],
            'points' => 3,
            'reason' => 'sale',
        ]);
    }

    public function test_invoice_payment_rejects_overpayment_and_double_payment(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Formation', 'unit_price' => 8000, 'quantity' => 1],
            ],
        ])->json();

        $this->postJson("/api/invoices/{$invoice['id']}/payments", ['amount' => 999999, 'payment_method' => 'cash'])
            ->assertStatus(422);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", ['amount' => 8000, 'payment_method' => 'cash'])
            ->assertOk();

        $this->postJson("/api/invoices/{$invoice['id']}/payments", ['amount' => 1000, 'payment_method' => 'cash'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Cette facture est déjà soldée.');
    }

    public function test_cancelled_invoice_cannot_be_paid(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->postJson('/api/invoices', [
            'items' => [
                ['label' => 'Conseil', 'unit_price' => 5000, 'quantity' => 1],
            ],
        ])->json();

        $this->postJson("/api/invoices/{$invoice['id']}/cancel")->assertOk();
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'status' => 'cancelled']);

        $this->postJson("/api/invoices/{$invoice['id']}/payments", ['amount' => 5000, 'payment_method' => 'cash'])
            ->assertStatus(422)
            ->assertJsonPath('message', "Impossible d'encaisser une facture annulée.");
    }

    public function test_promotion_overlap_rejected_and_effective_price_updated(): void
    {
        $this->actingAsAdmin();
        $service = Service::factory()->create(['price' => 10000]);

        $first = $this->postJson("/api/services/{$service->id}/promotions", [
            'type' => 'percent',
            'discount_percent' => 20,
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-15',
        ]);
        $first->assertStatus(201);

        $this->postJson("/api/services/{$service->id}/promotions", [
            'type' => 'amount',
            'promo_price' => 7000,
            'start_date' => '2026-08-10',
            'end_date' => '2026-08-20',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('start_date');

        $this->getJson("/api/services/{$service->id}")
            ->assertOk()
            ->assertJsonPath('effective_price', '8000');
    }

    public function test_non_authorized_role_cannot_access_clients(): void
    {
        $clientUser = $this->userWithRole('client');
        Sanctum::actingAs($clientUser);

        $this->getJson('/api/clients')->assertStatus(403);
        $this->postJson('/api/clients', [
            'first_name' => 'X',
            'last_name' => 'Y',
            'email' => 'xy@example.com',
        ])->assertStatus(403);
    }

    public function test_stats_overview_exposes_counters_and_top_commercials(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/commercials', [
            'first_name' => 'Top',
            'last_name' => 'Vendeur',
            'email' => 'top@example.com',
            'commission_type' => 'percent',
            'commission_value' => 5,
        ])->assertStatus(201);

        $this->getJson('/api/stats/overview')
            ->assertOk()
            ->assertJsonStructure([
                'revenue', 'outstanding', 'invoices_total', 'clients_total',
                'commercials_active', 'agencies_total', 'departments_total', 'users_total',
                'top_commercials' => [],
            ])
            ->assertJsonPath('commercials_active', 1);

        $this->getJson('/api/stats/dashboard')->assertOk();
    }

    public function test_login_logs_activity(): void
    {
        $user = $this->userWithRole('client');

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('login_logs', ['user_id' => $user->id, 'action' => 'login']);
        $this->assertDatabaseHas('activity_logs', ['user_id' => $user->id, 'entity_type' => 'auth', 'action' => 'login']);
    }

    public function test_role_change_and_assignments_are_logged(): void
    {
        $admin = $this->actingAsAdmin();
        $commercialRoleId = Role::where('name', 'commercial')->value('id');

        $user = User::factory()->create();
        $this->putJson("/api/users/{$user->id}", ['role_id' => $commercialRoleId])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $admin->id,
            'entity_type' => 'user',
            'action' => 'role_changed',
            'entity_id' => $user->id,
        ]);

        $agency = Agency::factory()->create();
        $this->postJson("/api/agencies/{$agency->id}/users", ['user_id' => $user->id])->assertStatus(201);

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $admin->id,
            'entity_type' => 'agency',
            'action' => 'assigned',
            'entity_id' => $agency->id,
        ]);
    }

    public function test_agency_crud_is_logged_and_client_cannot_be_assigned(): void
    {
        $admin = $this->actingAsAdmin();

        $agency = Agency::factory()->create();

        $this->assertDatabaseHas('activity_logs', [
            'entity_type' => 'agency',
            'action' => 'created',
            'entity_id' => $agency->id,
        ]);

        $client = $this->userWithRole('client');

        $this->postJson("/api/agencies/{$agency->id}/users", ['user_id' => $client->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ce profil ne peut pas être assigné à une agence ou un département.');
    }
}
