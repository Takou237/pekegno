<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LearnerUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function userWithRole(string $roleName): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function learner(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', 'client')->value('id'),
        ], $attributes));
    }

    /**
     * Super-admin : les champs identiques au formulaire « nouvel apprenant »
     * sont bien enregistrés et renvoyés.
     */
    public function test_super_admin_updates_learner_information(): void
    {
        $this->userWithRole('super-admin');
        $learner = $this->learner();

        $response = $this->putJson("/api/learners/{$learner->id}", [
            'first_name' => 'Awa',
            'last_name' => 'Diallo',
            'email' => $learner->email,
            'phone' => '+225 27 01 02 03',
            'city' => 'Abidjan',
            'nationality' => 'Ivoirienne',
            'address' => 'Cocody, rue 12',
            'quartier' => 'Cocody',
            'occupation' => 'Ingénieur',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.first_name', 'Awa')
            ->assertJsonPath('data.city', 'Abidjan')
            ->assertJsonPath('data.occupation', 'Ingénieur');

        $this->assertDatabaseHas('users', [
            'id' => $learner->id,
            'first_name' => 'Awa',
            'last_name' => 'Diallo',
            'phone' => '+225 27 01 02 03',
            'quartier' => 'Cocody',
            'occupation' => 'Ingénieur',
        ]);
    }

    /** Les champs laissés vides (email, téléphone) sont effacés (null). */
    public function test_empty_text_fields_are_cleared(): void
    {
        $this->userWithRole('super-admin');
        $learner = $this->learner(['phone' => '01 02 03']);

        $response = $this->putJson("/api/learners/{$learner->id}", [
            'phone' => '',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('users', ['id' => $learner->id, 'phone' => null]);
    }

    /** Un email déjà pris par un autre utilisateur est refusé (422). */
    public function test_duplicate_email_is_rejected(): void
    {
        $this->userWithRole('super-admin');
        $other = $this->learner();
        $learner = $this->learner();

        $response = $this->putJson("/api/learners/{$learner->id}", [
            'email' => $other->email,
        ]);

        $response->assertStatus(422);
    }

    /** L'email de l'apprenant lui-même reste accepté (invariant). */
    public function test_keeping_own_email_is_allowed(): void
    {
        $this->userWithRole('super-admin');
        $learner = $this->learner();

        $response = $this->putJson("/api/learners/{$learner->id}", [
            'last_name' => 'Koné',
        ]);

        $response->assertOk()->assertJsonPath('data.last_name', 'Koné');
    }

    /** Un utilisateur qui n'est pas un apprenant (client) renvoie 404. */
    public function test_non_client_returns_404(): void
    {
        $this->userWithRole('super-admin');
        $commercial = $this->userWithRole('commercial');
        $this->assertNotEquals('client', $commercial->role?->name);

        $this->putJson("/api/learners/{$commercial->id}", [
            'last_name' => 'Test',
        ])->assertStatus(404);
    }

    /**
     * Un commercial ne peut modifier que les apprenants de son périmètre :
     * apprenant enregistré dans une autre agence sans inscription → 403.
     */
    public function test_out_of_scope_learner_is_forbidden(): void
    {
        $agencyA = Agency::factory()->create();
        $agencyB = Agency::factory()->create();

        $user = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Commercial::factory()->create([
            'user_id' => $user->id,
            'agency_id' => $agencyA->id,
        ]);
        Sanctum::actingAs($user);

        $learner = $this->learner(['registered_agency_id' => $agencyB->id]);

        $this->putJson("/api/learners/{$learner->id}", [
            'last_name' => 'Test',
        ])->assertStatus(403);
    }

    /** Un commercial du périmètre peut modifier un apprenant de son agence. */
    public function test_in_scope_commercial_can_update_learner(): void
    {
        $agency = Agency::factory()->create();

        $user = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        Commercial::factory()->create([
            'user_id' => $user->id,
            'agency_id' => $agency->id,
        ]);
        Sanctum::actingAs($user);

        $learner = $this->learner(['registered_agency_id' => $agency->id]);

        $this->putJson("/api/learners/{$learner->id}", [
            'first_name' => 'Marco',
        ])->assertOk()->assertJsonPath('data.first_name', 'Marco');
    }

    /** Sans la permission clients.modifier (ex. formateur), la route est fermée. */
    public function test_role_without_permission_is_forbidden(): void
    {
        $this->userWithRole('formateur');
        $learner = $this->learner();

        $this->putJson("/api/learners/{$learner->id}", [
            'last_name' => 'Test',
        ])->assertForbidden();
    }
}
