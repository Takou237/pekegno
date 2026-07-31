<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Department;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create(['name' => 'super-admin']);
        $this->admin = $this->makeUser($role->id);
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

    private function makeRole(string $name): Role
    {
        return Role::create(['name' => $name]);
    }

    private function makeCategory(): Category
    {
        return Category::create(['name' => 'Formation']);
    }

    private function makeAgency(): Agency
    {
        return Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => 'Agence Douala',
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);
    }

    private function makeDepartment(Agency $agency): Department
    {
        return Department::create([
            'agency_id' => $agency->id,
            'name' => 'Commercial',
        ]);
    }

    private function validServiceData(): array
    {
        return [
            'name' => 'Formation Marketing Digital',
            'category_id' => $this->makeCategory()->id,
            'price' => 250000,
            'coverage' => 'Nationale',
            'description' => 'Initiation au marketing digital.',
            'agency_id' => $this->makeAgency()->id,
        ];
    }

    // ─── INDEX ───────────────────────────────────────────

    public function test_can_list_services(): void
    {
        Sanctum::actingAs($this->admin);

        $data = $this->validServiceData();
        Service::create($data);
        Service::create(array_merge($data, ['name' => 'Formation Gestion']));

        $response = $this->getJson('/api/services');

        $response->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_can_search_services_by_name(): void
    {
        Sanctum::actingAs($this->admin);

        $data = $this->validServiceData();
        Service::create($data);
        Service::create(array_merge($data, [
            'name' => 'Consulting Stratégie',
            'description' => 'Accompagnement des directions générales.',
        ]));

        $response = $this->getJson('/api/services?search=Marketing');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_can_filter_services_by_category(): void
    {
        Sanctum::actingAs($this->admin);

        $category = $this->makeCategory();
        $other = Category::create(['name' => 'Consulting']);

        Service::create([
            'name' => 'Service A',
            'category_id' => $category->id,
            'price' => 10000,
            'agency_id' => $this->makeAgency()->id,
        ]);
        Service::create([
            'name' => 'Service B',
            'category_id' => $other->id,
            'price' => 10000,
            'agency_id' => $this->makeAgency()->id,
        ]);

        $response = $this->getJson("/api/services?category_id={$category->id}");

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['name' => 'Service A']);
    }

    public function test_can_paginate_services(): void
    {
        Sanctum::actingAs($this->admin);

        $data = $this->validServiceData();
        foreach (range(1, 25) as $i) {
            Service::create(array_merge($data, ['name' => "Service {$i}"]));
        }

        $response = $this->getJson('/api/services?per_page=10');

        $response->assertOk()
            ->assertJsonCount(10, 'data');
    }

    public function test_unauthenticated_user_cannot_list_services(): void
    {
        $response = $this->getJson('/api/services');

        $response->assertUnauthorized();
    }

    // ─── STORE ───────────────────────────────────────────

    public function test_can_create_service_with_agency(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/services', $this->validServiceData());

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => 'Formation Marketing Digital',
                'price' => '250000.00',
            ]);

        $this->assertDatabaseHas('services', ['name' => 'Formation Marketing Digital']);
    }

    public function test_can_create_service_with_department_only(): void
    {
        Sanctum::actingAs($this->admin);

        $department = $this->makeDepartment($this->makeAgency());

        $response = $this->postJson('/api/services', [
            'name' => 'Service Départemental',
            'category_id' => $this->makeCategory()->id,
            'price' => 50000,
            'department_id' => $department->id,
        ]);

        $response->assertCreated()
            ->assertJsonFragment(['name' => 'Service Départemental']);
    }

    public function test_cannot_create_service_without_agency_or_department(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/services', [
            'name' => 'Service Orphelin',
            'category_id' => $this->makeCategory()->id,
            'price' => 10000,
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['agency_id']);
    }

    public function test_cannot_create_service_without_required_fields(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/services', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'category_id', 'price']);
    }

    public function test_creating_service_records_initial_price_history(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/services', $this->validServiceData());

        $response->assertCreated();

        $this->assertDatabaseHas('price_history', [
            'price' => '250000.00',
            'changed_by' => $this->admin->id,
            'reason' => 'Prix initial',
        ]);
    }

    public function test_commercial_role_cannot_create_service(): void
    {
        $commercial = $this->makeUser($this->makeRole('commercial')->id);
        Sanctum::actingAs($commercial);

        $response = $this->postJson('/api/services', $this->validServiceData());

        $response->assertForbidden();
    }

    // ─── SHOW ────────────────────────────────────────────

    public function test_can_show_service(): void
    {
        Sanctum::actingAs($this->admin);

        $service = Service::create($this->validServiceData());

        $response = $this->getJson("/api/services/{$service->id}");

        $response->assertOk()
            ->assertJsonFragment(['id' => $service->id]);
    }

    public function test_show_returns_404_for_nonexistent_service(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/services/nonexistent-id');

        $response->assertNotFound();
    }

    // ─── UPDATE ──────────────────────────────────────────

    public function test_can_update_service(): void
    {
        Sanctum::actingAs($this->admin);

        $service = Service::create($this->validServiceData());

        $response = $this->putJson("/api/services/{$service->id}", [
            'name' => 'Formation Marketing Avancé',
        ]);

        $response->assertOk()
            ->assertJsonFragment(['name' => 'Formation Marketing Avancé']);
    }

    public function test_updating_price_records_price_history(): void
    {
        Sanctum::actingAs($this->admin);

        $service = Service::create($this->validServiceData());

        $response = $this->putJson("/api/services/{$service->id}", [
            'price' => 300000,
            'reason' => 'Révision tarifaire',
        ]);

        $response->assertOk()
            ->assertJsonFragment(['price' => '300000.00']);

        $this->assertDatabaseHas('price_history', [
            'service_id' => $service->id,
            'price' => '300000.00',
            'changed_by' => $this->admin->id,
            'reason' => 'Révision tarifaire',
        ]);
    }

    public function test_updating_service_without_price_change_does_not_record_history(): void
    {
        Sanctum::actingAs($this->admin);

        $created = $this->postJson('/api/services', $this->validServiceData())->assertCreated();

        $this->putJson("/api/services/{$created->json('id')}", [
            'name' => 'Nouveau nom',
        ])->assertOk();

        $this->assertDatabaseCount('price_history', 1);
    }

    // ─── DELETE / TRASH / RESTORE / FORCE DELETE ─────────

    public function test_can_delete_service(): void
    {
        Sanctum::actingAs($this->admin);

        $service = Service::create($this->validServiceData());

        $response = $this->deleteJson("/api/services/{$service->id}");

        $response->assertNoContent();
        $this->assertSoftDeleted('services', ['id' => $service->id]);
    }

    public function test_can_list_trashed_services(): void
    {
        Sanctum::actingAs($this->admin);

        $deleted = Service::create($this->validServiceData());
        $deleted->delete();
        Service::create($this->validServiceData());

        $response = $this->getJson('/api/services/trash');

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_can_restore_service(): void
    {
        Sanctum::actingAs($this->admin);

        $service = Service::create($this->validServiceData());
        $service->delete();

        $response = $this->postJson("/api/services/{$service->id}/restore");

        $response->assertOk()
            ->assertJsonFragment(['id' => $service->id]);

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
            'deleted_at' => null,
        ]);
    }

    public function test_can_force_delete_service(): void
    {
        Sanctum::actingAs($this->admin);

        $service = Service::create($this->validServiceData());
        $service->delete();

        $response = $this->deleteJson("/api/services/{$service->id}/force-delete");

        $response->assertNoContent();
        $this->assertDatabaseMissing('services', ['id' => $service->id]);
    }
}
