<?php

namespace Tests\Feature;

use App\Models\ClientCategory;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class Phase2AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, ClientCategorySeeder::class]);
    }

    private function createStaff(string $role = 'super-admin', array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', $role)->value('id'),
        ], $attributes));
    }

    private function registerClient(array $attributes = []): array
    {
        return $this->postJson('/api/client/register', array_merge([
            'first_name' => 'Claire',
            'last_name' => 'Abonnée',
            'email' => 'claire@example.com',
            'phone' => '+237690000000',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], $attributes))->assertStatus(201)->json();
    }

    private function clientLogin(string $email = 'claire@example.com', string $password = 'password123'): array
    {
        return $this->postJson('/api/client/login', [
            'email' => $email,
            'password' => $password,
        ])->assertOk()->json();
    }

    public function test_staff_login_returns_staff_token(): void
    {
        $staff = $this->createStaff();

        $response = $this->postJson('/api/staff/login', [
            'email' => $staff->email,
            'password' => 'password',
        ])->assertOk();

        $this->assertSame('super-admin', $response->json('user.role.name'));
        $this->assertNotEmpty($response->json('token'));
        $this->assertDatabaseHas('personal_access_tokens', [
            'name' => 'staff-token',
            'tokenable_id' => $staff->id,
        ]);
    }

    public function test_client_cannot_login_via_staff_portal(): void
    {
        $this->registerClient();

        $this->postJson('/api/staff/login', [
            'email' => 'claire@example.com',
            'password' => 'password123',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_client_register_creates_prospect_account(): void
    {
        $this->registerClient();

        $this->assertDatabaseHas('users', [
            'email' => 'claire@example.com',
            'role_id' => Role::where('name', 'client')->value('id'),
            'client_category_id' => ClientCategory::where('slug', 'prospect')->value('id'),
            'is_active' => true,
        ]);

        $client = User::where('email', 'claire@example.com')->firstOrFail();
        $this->assertStringStartsWith('CL-', $client->client_number);
        $this->assertTrue(Hash::check('password123', $client->password));
    }

    public function test_client_register_rejects_duplicate_email(): void
    {
        $this->registerClient();

        $this->postJson('/api/client/register', [
            'first_name' => 'Autre',
            'last_name' => 'Client',
            'email' => 'claire@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_client_login_returns_client_token(): void
    {
        $this->registerClient();

        $response = $this->postJson('/api/client/login', [
            'email' => 'claire@example.com',
            'password' => 'password123',
        ])->assertOk();
        $this->assertSame('claire@example.com', $response->json('user.email'));
        $this->assertNotEmpty($response->json('token'));

        $this->assertDatabaseHas('personal_access_tokens', [
            'name' => 'client-token',
            'tokenable_id' => User::where('email', 'claire@example.com')->value('id'),
        ]);
    }

    public function test_staff_cannot_login_via_client_portal(): void
    {
        $staff = $this->createStaff();

        $this->postJson('/api/client/login', [
            'email' => $staff->email,
            'password' => 'password',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_client_me_returns_profile(): void
    {
        $this->registerClient();
        $login = $this->clientLogin();

        \Illuminate\Support\Facades\Auth::forgetGuards();

        $this->withToken($login['token'])
            ->getJson('/api/client/me')
            ->assertOk()
            ->assertJsonPath('email', 'claire@example.com')
            ->assertJsonPath('role.name', 'client');
    }

    public function test_client_logout_revokes_token(): void
    {
        $this->registerClient();
        $login = $this->clientLogin();

        $this->withToken($login['token'])
            ->postJson('/api/client/logout')
            ->assertStatus(204);

        $this->assertDatabaseCount('personal_access_tokens', 0);

        \Illuminate\Support\Facades\Auth::forgetGuards();

        $this->withToken($login['token'])
            ->getJson('/api/client/me')
            ->assertStatus(401);
    }

    public function test_client_token_blocked_on_staff_endpoints(): void
    {
        $this->registerClient();
        $login = $this->clientLogin();

        $this->withToken($login['token'])
            ->getJson('/api/clients')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Cet espace est réservé au personnel.');
    }

    public function test_staff_token_blocked_on_client_endpoints(): void
    {
        $staff = $this->createStaff();

        $login = $this->postJson('/api/staff/login', [
            'email' => $staff->email,
            'password' => 'password',
        ])->assertOk()->json();

        $this->withToken($login['token'])
            ->getJson('/api/client/me')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Cet espace est réservé aux clients.');
    }

    public function test_account_locks_after_five_failed_attempts(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);

        $staff = $this->createStaff();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/staff/login', [
                'email' => $staff->email,
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $staff->refresh();
        $this->assertNotNull($staff->locked_until);
        $this->assertSame(0, $staff->failed_attempts);

        $this->postJson('/api/staff/login', [
            'email' => $staff->email,
            'password' => 'password',
        ])->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Ce compte est temporairement bloqué. Réessayez dans quelques minutes.');

        $staff->update(['locked_until' => now()->subMinute()]);

        $this->postJson('/api/staff/login', [
            'email' => $staff->email,
            'password' => 'password',
        ])->assertOk();
    }

    public function test_inactive_account_cannot_login(): void
    {
        $staff = $this->createStaff('super-admin', ['is_active' => false]);

        $this->postJson('/api/staff/login', [
            'email' => $staff->email,
            'password' => 'password',
        ])->assertStatus(422);
    }
}