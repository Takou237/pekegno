<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\Country;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AgencyCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
    }

    private function validAgencyData(): array
    {
        return [
            'code' => 'AG-001',
            'name' => 'Agence Paris',
            'country' => 'France',
            'city' => 'Paris',
            'address' => '123 Rue de la Paix',
            'phone' => '+33123456789',
            'email' => 'contact@agence.fr',
        ];
    }

    // ─── INDEX ───────────────────────────────────────────

    public function test_can_list_agencies(): void
    {
        Sanctum::actingAs($this->admin);

        Agency::factory()->count(3)->create();

        $response = $this->getJson('/api/agencies');

        $response->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_can_search_agencies_by_name(): void
    {
        Sanctum::actingAs($this->admin);

        Agency::factory()->create(['name' => 'Agence Paris']);
        Agency::factory()->create(['name' => 'Agence Tokyo']);

        $response = $this->getJson('/api/agencies?search=Paris');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_can_filter_agencies_by_country(): void
    {
        Sanctum::actingAs($this->admin);

        Agency::factory()->create(['country' => 'France']);
        Agency::factory()->create(['country' => 'Belgique']);

        $response = $this->getJson('/api/agencies?country=France');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_can_paginate_agencies(): void
    {
        Sanctum::actingAs($this->admin);

        Agency::factory()->count(25)->create();

        $response = $this->getJson('/api/agencies?per_page=10');

        $response->assertOk()
            ->assertJsonCount(10, 'data');
    }

    public function test_unauthenticated_user_cannot_list_agencies(): void
    {
        $response = $this->getJson('/api/agencies');

        $response->assertUnauthorized();
    }

    // ─── STORE ───────────────────────────────────────────

    public function test_can_create_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/agencies', $this->validAgencyData());

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => 'Agence Paris',
                'country' => 'France',
            ]);

        $this->assertMatchesRegularExpression('/^AG\d{3}$/', $response->json('code'));
        $this->assertDatabaseHas('agencies', [
            'code' => $response->json('code'),
            'name' => 'Agence Paris',
        ]);
    }

    public function test_cannot_create_agency_without_required_fields(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/agencies', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'country']);
    }

    public function test_agency_code_is_auto_generated(): void
    {
        Sanctum::actingAs($this->admin);

        $first = $this->postJson('/api/agencies', $this->validAgencyData());
        $first->assertCreated();
        $firstCode = $first->json('code');
        $this->assertMatchesRegularExpression('/^AG\d{3}$/', $firstCode);

        $second = $this->postJson('/api/agencies', $this->validAgencyData());
        $second->assertCreated();

        $this->assertNotSame($firstCode, $second->json('code'));
    }

    public function test_cannot_create_agency_with_invalid_email(): void
    {
        Sanctum::actingAs($this->admin);

        $data = $this->validAgencyData();
        $data['email'] = 'not-an-email';

        $response = $this->postJson('/api/agencies', $data);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    // ─── SHOW ────────────────────────────────────────────

    public function test_can_show_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();

        $response = $this->getJson("/api/agencies/{$agency->id}");

        $response->assertOk()
            ->assertJsonFragment(['id' => $agency->id]);
    }

    public function test_show_returns_404_for_nonexistent_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/agencies/nonexistent-id');

        $response->assertNotFound();
    }

    // ─── UPDATE ──────────────────────────────────────────

    public function test_can_update_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();

        $response = $this->putJson("/api/agencies/{$agency->id}", [
            'name' => 'Agence Updated',
        ]);

        $response->assertOk()
            ->assertJsonFragment(['name' => 'Agence Updated']);

        $this->assertDatabaseHas('agencies', [
            'id' => $agency->id,
            'name' => 'Agence Updated',
        ]);
    }

    public function test_update_country_id_reassigns_agency_elements(): void
    {
        Sanctum::actingAs($this->admin);

        $cameroon = Country::create(['name' => 'Cameroun', 'code' => 'CM', 'currency_code' => 'XAF']);
        $ivoryCoast = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CI', 'currency_code' => 'XOF']);

        $agency = Agency::factory()->create([
            'country_id' => $cameroon->id,
            'country' => 'Cameroun',
        ]);

        // Utilisateur affecté à l'agence (affectation principale)
        $assignedUser = User::factory()->create(['country_id' => $cameroon->id]);
        DB::table('user_assignments')->insert([
            'user_id' => $assignedUser->id,
            'agency_id' => $agency->id,
            'is_primary' => true,
        ]);

        // Utilisateur affecté ici mais affecté PRINCIPALEMENT ailleurs : ne doit pas bouger
        $otherAgency = Agency::factory()->create(['country_id' => $cameroon->id]);
        $otherUser = User::factory()->create(['country_id' => $cameroon->id]);
        DB::table('user_assignments')->insert([
            ['user_id' => $otherUser->id, 'agency_id' => $agency->id, 'is_primary' => false],
            ['user_id' => $otherUser->id, 'agency_id' => $otherAgency->id, 'is_primary' => true],
        ]);

        // Logs rattachés à l'agence
        ActivityLog::create(['agency_id' => $agency->id, 'country_id' => $cameroon->id, 'action' => 'test', 'entity_type' => 'test']);
        ActivityLog::create(['agency_id' => $agency->id, 'country_id' => $cameroon->id, 'action' => 'test', 'entity_type' => 'test']);
        // Log d'une autre agence : ne doit pas bouger
        ActivityLog::create(['agency_id' => $otherAgency->id, 'country_id' => $cameroon->id, 'action' => 'test', 'entity_type' => 'test']);

        $response = $this->putJson("/api/agencies/{$agency->id}", [
            'country' => "Côte d'Ivoire",
            'country_id' => $ivoryCoast->id,
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('agencies', [
            'id' => $agency->id,
            'country_id' => $ivoryCoast->id,
            'country' => "Côte d'Ivoire",
        ]);

        // L'utilisateur affecté (principal) bascule avec son agence
        $this->assertDatabaseHas('users', [
            'id' => $assignedUser->id,
            'country_id' => $ivoryCoast->id,
        ]);

        // L'utilisateur affecté principalement ailleurs garde son pays d'origine
        $this->assertDatabaseHas('users', [
            'id' => $otherUser->id,
            'country_id' => $cameroon->id,
        ]);

        // Les logs préexistants de l'agence suivent le nouveau pays (l'update
        // génère aussi ses propres logs, d'où le filtre sur l'action 'test')
        $this->assertSame(0, ActivityLog::where('agency_id', $agency->id)->where('country_id', $cameroon->id)->count());
        $this->assertSame(2, ActivityLog::where('agency_id', $agency->id)->where('country_id', $ivoryCoast->id)->where('action', 'test')->count());

        // Le log de l'autre agence garde le pays d'origine
        $this->assertDatabaseHas('activity_logs', [
            'agency_id' => $otherAgency->id,
            'action' => 'test',
            'country_id' => $cameroon->id,
        ]);
    }

    public function test_cannot_update_agency_code_to_duplicate(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create(['code' => 'AG-001']);
        Agency::factory()->create(['code' => 'AG-002']);

        $response = $this->putJson("/api/agencies/{$agency->id}", [
            'code' => 'AG-002',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_update_returns_404_for_nonexistent_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->putJson('/api/agencies/nonexistent-id', [
            'name' => 'Test',
        ]);

        $response->assertNotFound();
    }

    // ─── DELETE ──────────────────────────────────────────

    public function test_can_delete_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();

        $response = $this->deleteJson("/api/agencies/{$agency->id}");

        $response->assertNoContent();

        $this->assertSoftDeleted('agencies', ['id' => $agency->id]);
    }

    public function test_can_delete_agency_with_departments(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();
        $department = Department::factory()->create(['agency_id' => $agency->id]);

        $response = $this->deleteJson("/api/agencies/{$agency->id}");

        $response->assertNoContent();
        $this->assertSoftDeleted('agencies', ['id' => $agency->id]);
        $this->assertSoftDeleted('departments', ['id' => $department->id]);
    }

    public function test_can_delete_agency_with_assigned_users(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();
        $user = User::factory()->create();
        $agency->assignedUsers()->attach($user->id);

        $response = $this->deleteJson("/api/agencies/{$agency->id}");

        $response->assertNoContent();
        $this->assertSoftDeleted('agencies', ['id' => $agency->id]);
        $this->assertDatabaseMissing('user_assignments', [
            'agency_id' => $agency->id,
            'user_id' => $user->id,
        ]);
    }

    // ─── TRASH / RESTORE / FORCE DELETE ──────────────────

    public function test_can_list_trashed_agencies(): void
    {
        Sanctum::actingAs($this->admin);

        Agency::factory()->create(['deleted_at' => now()]);
        Agency::factory()->create();

        $response = $this->getJson('/api/agencies/trash');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_can_restore_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create(['deleted_at' => now()]);

        $response = $this->postJson("/api/agencies/{$agency->id}/restore");

        $response->assertOk()
            ->assertJsonFragment(['id' => $agency->id]);

        $this->assertDatabaseHas('agencies', [
            'id' => $agency->id,
            'deleted_at' => null,
        ]);
    }

    public function test_restore_returns_404_for_non_trashed_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();

        $response = $this->postJson("/api/agencies/{$agency->id}/restore");

        $response->assertNotFound();
    }

    public function test_can_force_delete_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create(['deleted_at' => now()]);

        $response = $this->deleteJson("/api/agencies/{$agency->id}/force-delete");

        $response->assertNoContent();

        $this->assertDatabaseMissing('agencies', ['id' => $agency->id]);
    }

    public function test_force_delete_returns_404_for_non_trashed_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create();

        $response = $this->deleteJson("/api/agencies/{$agency->id}/force-delete");

        $response->assertNotFound();
    }

    public function test_can_force_delete_agency_with_trashed_departments(): void
    {
        Sanctum::actingAs($this->admin);

        $agency = Agency::factory()->create(['deleted_at' => now()]);
        Department::factory()->create(['agency_id' => $agency->id]);

        $response = $this->deleteJson("/api/agencies/{$agency->id}/force-delete");

        $response->assertNoContent();
        $this->assertDatabaseMissing('agencies', ['id' => $agency->id]);
    }
}
