<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientEmployeeSeparationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $agencyChief;

    private Role $clientRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->makeUser(Role::create(['name' => 'super-admin'])->id);
        $this->agencyChief = $this->makeUser(Role::create(['name' => 'responsable-agence'])->id);
        $this->clientRole = Role::create(['name' => 'client']);
    }

    private function makeUser(string $roleId): User
    {
        return User::create([
            'username' => fake()->unique()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'role_id' => $roleId,
            'is_active' => true,
        ]);
    }

    private function makeClient(?string $email = null): User
    {
        return User::create([
            'username' => fake()->unique()->userName(),
            'email' => $email ?? fake()->unique()->safeEmail(),
            'password' => 'password',
            'first_name' => 'Aïcha',
            'last_name' => 'Ngassa',
            'role_id' => $this->clientRole->id,
            'is_active' => true,
        ]);
    }

    // ─── INSCRIPTION → RÔLE CLIENT ──────────────────────

    public function test_register_assigns_client_role(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'username' => 'nouveau.client',
            'email' => 'nouveau.client@email.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role.name', 'client')
            ->assertJsonStructure(['user', 'token']);

        $this->assertDatabaseHas('users', [
            'email' => 'nouveau.client@email.com',
            'role_id' => $this->clientRole->id,
        ]);
    }

    // ─── LISTINGS ISOLÉS ────────────────────────────────

    public function test_clients_are_excluded_from_users_listing(): void
    {
        Sanctum::actingAs($this->admin);

        $client = $this->makeClient();
        $employee = $this->makeUser(Role::create(['name' => 'commercial'])->id);

        $response = $this->getJson('/api/users');

        $response->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonFragment(['email' => $employee->email])
            ->assertJsonMissing(['id' => $client->id]);
    }

    public function test_employee_user_is_excluded_from_clients_listing(): void
    {
        Sanctum::actingAs($this->admin);

        $client = $this->makeClient();
        $employee = $this->makeUser(Role::create(['name' => 'formateur'])->id);

        $response = $this->getJson('/api/clients');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['id' => $client->id])
            ->assertJsonMissing(['id' => $employee->id]);
    }

    public function test_clients_listing_supports_search(): void
    {
        Sanctum::actingAs($this->admin);

        $this->makeClient();
        $other = $this->makeClient();
        $other->update(['first_name' => 'Bertrand', 'last_name' => 'Owona']);

        $response = $this->getJson('/api/clients?search=Owona');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['id' => $other->id]);
    }

    // ─── ACCÈS RÉSERVÉ AU PERSONNEL ─────────────────────

    public function test_client_cannot_access_clients_listing(): void
    {
        Sanctum::actingAs($this->makeClient());

        $this->getJson('/api/clients')->assertForbidden();
        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_employee_endpoints_reject_client_accounts(): void
    {
        Sanctum::actingAs($this->admin);

        $client = $this->makeClient();

        $this->getJson("/api/users/{$client->id}")->assertForbidden();
        $this->putJson("/api/users/{$client->id}", ['first_name' => 'Hack'])->assertForbidden();
        $this->deleteJson("/api/users/{$client->id}")->assertForbidden();
        $this->putJson("/api/users/{$client->id}/role", ['role_id' => $this->clientRole->id])->assertUnprocessable();
    }

    public function test_client_endpoints_reject_employee_accounts(): void
    {
        Sanctum::actingAs($this->admin);

        $employee = $this->makeUser(Role::create(['name' => 'comptable'])->id);

        $this->getJson("/api/clients/{$employee->id}")->assertNotFound();
        $this->putJson("/api/clients/{$employee->id}", ['is_active' => false])->assertNotFound();
    }

    // ─── GESTION D'UN CLIENT ────────────────────────────

    public function test_admin_can_toggle_client_activity(): void
    {
        Sanctum::actingAs($this->admin);

        $client = $this->makeClient();

        $response = $this->putJson("/api/clients/{$client->id}", ['is_active' => false]);

        $response->assertOk()
            ->assertJsonPath('is_active', false);

        $this->assertDatabaseHas('users', [
            'id' => $client->id,
            'is_active' => false,
        ]);
    }

    // ─── CRÉATION D'EMPLOYÉS ────────────────────────────

    public function test_cannot_create_employee_with_client_role(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/users', [
            'username' => 'employe.fictif',
            'email' => 'employe.fictif@email.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role_id' => $this->clientRole->id,
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['role_id']);

        $this->assertDatabaseMissing('users', ['email' => 'employe.fictif@email.com']);
    }

    public function test_responsible_agency_creates_employee_in_his_agency(): void
    {
        Sanctum::actingAs($this->agencyChief);

        $agency = Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => 'Agence Douala',
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);
        $this->agencyChief->assignments()->attach($agency->id, [
            'is_primary' => true,
            'department_id' => null,
        ]);

        $response = $this->postJson('/api/users', [
            'username' => 'commercial.douala',
            'email' => 'commercial.douala@email.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'first_name' => 'Carl',
            'last_name' => 'Etoa',
        ]);

        $response->assertCreated();

        $created = User::where('email', 'commercial.douala@email.com')->first();
        $this->assertDatabaseHas('user_assignments', [
            'user_id' => $created->id,
            'agency_id' => $agency->id,
            'is_primary' => false,
        ]);
    }

    public function test_responsible_agency_cannot_create_direction_or_chief(): void
    {
        Sanctum::actingAs($this->agencyChief);

        $roleNames = ['direction-generale', 'responsable-agence', 'responsable-departement'];
        $existing = Role::pluck('name')->all();
        foreach ($roleNames as $roleName) {
            $role = in_array($roleName, $existing, true)
                ? Role::where('name', $roleName)->first()
                : Role::create(['name' => $roleName]);

            $response = $this->postJson('/api/users', [
                'username' => fake()->unique()->userName(),
                'email' => fake()->unique()->safeEmail(),
                'password' => 'password',
                'password_confirmation' => 'password',
                'role_id' => $role->id,
            ]);

            $response->assertUnprocessable()
                ->assertJsonValidationErrors(['role_id']);
        }
    }

    public function test_super_admin_can_create_employee_with_assignable_role(): void
    {
        Sanctum::actingAs($this->admin);

        $role = Role::create(['name' => 'caissier']);

        $response = $this->postJson('/api/users', [
            'username' => 'caissier.yaounde',
            'email' => 'caissier.yaounde@email.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role_id' => $role->id,
        ]);

        $response->assertCreated()
            ->assertJsonPath('role.name', 'caissier');
    }

    public function test_admin_can_edit_user_keeping_non_assignable_role(): void
    {
        Sanctum::actingAs($this->admin);

        $chiefRole = Role::where('name', 'responsable-agence')->firstOrFail();
        $chief = $this->makeUser($chiefRole->id);

        $response = $this->putJson("/api/users/{$chief->id}", [
            'first_name' => 'Nouveau',
            'role_id' => $chiefRole->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('first_name', 'Nouveau')
            ->assertJsonPath('role.name', 'responsable-agence');
    }
}
