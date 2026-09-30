<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tout compte de rôle « commercial » doit posséder une ligne dans la table
 * `commercials` : son tableau de bord la retrouve via user_id. Sans elle,
 * le dashboard répond « aucun profil commercial associé » — c'était le cas
 * pour les commerciaux créés via « nouvel utilisateur » (contrairement aux
 * comptes seedés qui avaient leur profil créé à la main).
 */
class CommercialProfileAutoCreationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_creating_commercial_user_creates_linked_commercial_profile(): void
    {
        $this->actingAsRole('super-admin');

        $agency = Agency::create(['code' => 'DLA', 'name' => 'Agence Principale Douala', 'country' => 'Cameroun']);

        $this->postJson('/api/users', [
            'username' => 'thibault.noupoue',
            'email' => 'thibault.noupoue@example.com',
            'first_name' => 'Thibault',
            'last_name' => 'Noupoue',
            'role_id' => Role::where('name', 'commercial')->value('id'),
            'agency_id' => $agency->id,
        ])->assertCreated();

        $user = User::where('email', 'thibault.noupoue@example.com')->first();

        $commercial = Commercial::where('user_id', $user->id)->first();
        $this->assertNotNull($commercial, 'Le profil commercial lié doit exister dès la création du compte.');
        $this->assertSame('Thibault', $commercial->first_name);
        $this->assertSame('Noupoue', $commercial->last_name);
        $this->assertSame('thibault.noupoue@example.com', $commercial->email);
        $this->assertSame($agency->id, $commercial->agency_id);
        $this->assertSame('commercial', $commercial->kind);
        $this->assertTrue($commercial->is_active);
    }

    public function test_creating_commercial_without_agency_still_creates_profile(): void
    {
        $this->actingAsRole('super-admin');

        $this->postJson('/api/users', [
            'username' => 'sans.agence',
            'email' => 'sans.agence@example.com',
            'first_name' => 'Sans',
            'last_name' => 'Agence',
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ])->assertCreated();

        $user = User::where('email', 'sans.agence@example.com')->first();

        $commercial = Commercial::where('user_id', $user->id)->first();
        $this->assertNotNull($commercial);
        $this->assertNull($commercial->agency_id);
    }

    public function test_creating_non_commercial_user_creates_no_profile(): void
    {
        $this->actingAsRole('super-admin');

        $this->postJson('/api/users', [
            'username' => 'simple.caissier',
            'email' => 'simple.caissier@example.com',
            'first_name' => 'Simple',
            'last_name' => 'Caissier',
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ])->assertCreated();

        $user = User::where('email', 'simple.caissier@example.com')->first();

        $this->assertNull(Commercial::where('user_id', $user->id)->first());
    }

    public function test_me_stats_endpoint_works_for_newly_created_commercial(): void
    {
        $this->actingAsRole('super-admin');

        $this->postJson('/api/users', [
            'username' => 'nouveau.commercial',
            'email' => 'nouveau.commercial@example.com',
            'first_name' => 'Nouveau',
            'last_name' => 'Commercial',
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ])->assertCreated();

        $commercialUser = User::where('email', 'nouveau.commercial@example.com')->first();
        Sanctum::actingAs($commercialUser);

        // C'est exactement l'appel qui échouait en 404 avant le correctif.
        $this->getJson('/api/commercials/me/stats')
            ->assertOk()
            ->assertJsonPath('commercial.email', 'nouveau.commercial@example.com');
    }

    public function test_promoting_existing_user_to_commercial_creates_profile(): void
    {
        $this->actingAsRole('super-admin');

        $caissier = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
            'first_name' => 'Promu',
            'last_name' => 'Commercial',
            'email' => 'promu.commercial@example.com',
        ]);

        $this->assertNull(Commercial::where('user_id', $caissier->id)->first());

        $this->putJson("/api/users/{$caissier->id}", [
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ])->assertOk();

        $commercial = Commercial::where('user_id', $caissier->id)->first();
        $this->assertNotNull($commercial, 'La promotion vers commercial doit créer le profil métier.');
        $this->assertSame('Promu', $commercial->first_name);
    }

    public function test_updating_existing_commercial_profile_does_not_duplicate(): void
    {
        $this->actingAsRole('super-admin');

        $commercial = Commercial::create([
            'first_name' => 'Carlos',
            'last_name' => 'Fotso',
            'email' => 'carlos@example.com',
            'kind' => 'commercial',
        ]);
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
            'first_name' => 'Carlos',
            'last_name' => 'Fotso',
        ]);
        $commercial->update(['user_id' => $user->id]);

        $this->putJson("/api/users/{$user->id}", [
            'first_name' => 'Carlos-Modifié',
        ])->assertOk();

        $this->assertSame(1, Commercial::withTrashed()->where('user_id', $user->id)->count());
    }

    /**
     * `user_assignments.is_primary` désigne le CHEF d'agence, pas l'agence principale
     * du compte : l'index unique partiel uq_agency_chief n'en autorise qu'un seul par
     * agence. Le marquer à la création hissait chaque nouvel employé au rang de chef
     * d'agence et faisait échouer la création en violation de clé unique dès qu'un
     * chef existait déjà — impossible de créer un second caissier sur une agence.
     */
    public function test_several_employees_can_be_created_on_an_agency_that_already_has_a_chief(): void
    {
        $this->actingAsRole('super-admin');

        $agency = Agency::create(['code' => 'DLA', 'name' => 'Agence Principale Douala', 'country' => 'Cameroun']);

        $chief = User::factory()->create([
            'role_id' => Role::where('name', 'responsable-agence')->value('id'),
        ]);
        DB::table('user_assignments')->insert([
            'user_id' => $chief->id,
            'agency_id' => $agency->id,
            'department_id' => null,
            'is_primary' => true,
            'is_department_chief' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (['caissier.un', 'caissier.deux'] as $username) {
            $this->postJson('/api/users', [
                'username' => $username,
                'email' => $username.'@example.com',
                'first_name' => 'Caissier',
                'last_name' => $username,
                'role_id' => Role::where('name', 'caissier')->value('id'),
                'agency_id' => $agency->id,
            ])->assertCreated();
        }

        // Les deux caissiers sont rattachés, sans être hissés chef d'agence, et le
        // chef titulaire n'a pas été déplacé.
        $this->assertSame(2, DB::table('user_assignments')
            ->where('agency_id', $agency->id)
            ->where('is_primary', false)
            ->count());

        $this->assertSame(1, DB::table('user_assignments')
            ->where('agency_id', $agency->id)
            ->where('is_primary', true)
            ->where('user_id', $chief->id)
            ->count());
    }
}
