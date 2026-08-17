<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase4EmployeesTest extends TestCase
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

    private function createUserWithRole(string $roleName): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);
    }

    public function test_employee_created_via_employees_endpoint(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/employees', [
            'first_name' => 'Jean',
            'last_name' => 'Emploi',
            'email' => 'employe@example.com',
            'kind' => 'employe',
        ])
            ->assertStatus(201)
            ->assertJsonPath('kind', 'employe');

        $this->assertDatabaseHas('commercials', [
            'email' => 'employe@example.com',
            'kind' => 'employe',
        ]);
    }

    public function test_default_kind_is_commercial(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/commercials', [
            'first_name' => 'Marie',
            'last_name' => 'Com',
            'email' => 'com@example.com',
        ])->assertStatus(201);

        $this->assertDatabaseHas('commercials', [
            'email' => 'com@example.com',
            'kind' => 'commercial',
        ]);
    }

    public function test_employee_can_be_linked_to_caissier_account(): void
    {
        $this->actingAsAdmin();
        $caissier = $this->createUserWithRole('caissier');

        $this->postJson('/api/employees', [
            'user_id' => $caissier->id,
            'first_name' => 'Agent',
            'last_name' => 'Caisse',
            'kind' => 'employe',
        ])->assertStatus(201);

        $this->assertDatabaseHas('commercials', [
            'user_id' => $caissier->id,
            'kind' => 'employe',
        ]);
    }

    public function test_caissier_account_rejected_for_commercial(): void
    {
        $this->actingAsAdmin();
        $caissier = $this->createUserWithRole('caissier');

        $this->postJson('/api/commercials', [
            'user_id' => $caissier->id,
            'first_name' => 'Pas',
            'last_name' => 'Autorisé',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['user_id']);
    }

    public function test_index_filters_by_kind(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/commercials', [
            'first_name' => 'Vendeur',
            'last_name' => 'Un',
            'email' => 'v1@example.com',
        ])->assertStatus(201);

        $this->postJson('/api/employees', [
            'first_name' => 'Employé',
            'last_name' => 'Deux',
            'email' => 'e2@example.com',
            'kind' => 'employe',
        ])->assertStatus(201);

        $commercials = $this->getJson('/api/commercials')->json('data');
        $this->assertCount(1, $commercials);
        $this->assertSame('commercial', $commercials[0]['kind']);

        $employees = $this->getJson('/api/employees')->json('data');
        $this->assertCount(1, $employees);
        $this->assertSame('employe', $employees[0]['kind']);

        $onlyEmployees = $this->getJson('/api/commercials?kind=employe')->json('data');
        $this->assertCount(1, $onlyEmployees);

        $onlyCommercials = $this->getJson('/api/employees?kind=commercial')->json('data');
        $this->assertCount(1, $onlyCommercials);
        $this->assertSame('commercial', $onlyCommercials[0]['kind']);
    }

    public function test_available_users_includes_caissiers_for_employees(): void
    {
        $this->actingAsAdmin();
        $caissier = $this->createUserWithRole('caissier');
        $this->createUserWithRole('commercial');

        $forEmployees = $this->getJson('/api/employees/available-users?kind=employe')->json();
        $this->assertContains($caissier->id, array_column($forEmployees, 'id'));

        $forCommercials = $this->getJson('/api/commercials/available-users')->json();
        $this->assertNotContains($caissier->id, array_column($forCommercials, 'id'));
    }

    public function test_commercial_can_be_converted_to_employee(): void
    {
        $this->actingAsAdmin();

        $created = $this->postJson('/api/commercials', [
            'first_name' => 'Karim',
            'last_name' => 'Vendeur',
            'email' => 'karim@example.com',
        ])->assertStatus(201)->json();

        $this->putJson("/api/employees/{$created['id']}", [
            'kind' => 'employe',
        ])
            ->assertOk()
            ->assertJsonPath('kind', 'employe');

        $this->assertDatabaseHas('commercials', [
            'id' => $created['id'],
            'kind' => 'employe',
        ]);
    }

    public function test_ranking_filters_by_kind(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/commercials', [
            'first_name' => 'Vendeur',
            'last_name' => 'Rank',
            'email' => 'rank1@example.com',
        ])->assertStatus(201);

        $this->postJson('/api/employees', [
            'first_name' => 'Employé',
            'last_name' => 'Rank',
            'email' => 'rank2@example.com',
            'kind' => 'employe',
        ])->assertStatus(201);

        $ranking = $this->getJson('/api/employees/ranking')->json();
        $this->assertCount(1, $ranking);
        $this->assertSame('rank2@example.com', $ranking[0]['email']);
    }

    public function test_employees_export_only_contains_employees(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/commercials', [
            'first_name' => 'Vendeur',
            'last_name' => 'Export',
            'email' => 'export1@example.com',
        ])->assertStatus(201);

        $this->postJson('/api/employees', [
            'first_name' => 'Employé',
            'last_name' => 'Export',
            'email' => 'export2@example.com',
            'kind' => 'employe',
        ])->assertStatus(201);

        $response = $this->get('/api/exports/employees')
            ->assertOk()
            ->assertDownload('employes.csv');

        $content = $response->streamedContent();
        $this->assertStringContainsString('Prénom', $content);
        $this->assertStringContainsString('export2@example.com', $content);
        $this->assertStringNotContainsString('export1@example.com', $content);
    }

    public function test_caissier_role_cannot_access_employees_endpoint(): void
    {
        $caissier = $this->createUserWithRole('caissier');
        Sanctum::actingAs($caissier);

        $this->getJson('/api/employees')
            ->assertForbidden()
            ->assertJsonPath('message', 'Action non autorisée.');
    }
}
