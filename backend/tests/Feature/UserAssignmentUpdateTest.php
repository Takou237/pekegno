<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Le formulaire « Modifier l'utilisateur » permet de changer l'agence et le
 * département de rattachement, comme à la création.
 */
class UserAssignmentUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function userWithRole(string $role): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
    }

    public function test_update_attaches_unassigned_user_to_agency_and_department(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $target = $this->userWithRole('caissier');
        $agency = Agency::factory()->create();
        $department = Department::factory()->create(['agency_id' => $agency->id]);

        $this->putJson("/api/users/{$target->id}", [
            'agency_id' => $agency->id,
            'department_id' => $department->id,
        ])->assertOk();

        $row = DB::table('user_assignments')->where('user_id', $target->id)->first();
        $this->assertSame($agency->id, $row->agency_id);
        $this->assertSame($department->id, $row->department_id);
    }

    public function test_update_moves_user_and_keeps_chief_assignment(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $target = $this->userWithRole('caissier');
        $old = Agency::factory()->create();
        $chiefOf = Agency::factory()->create();
        $new = Agency::factory()->create();
        $target->assignments()->attach($old->id, ['is_primary' => false, 'is_department_chief' => false]);
        $target->assignments()->attach($chiefOf->id, ['is_primary' => true, 'is_department_chief' => false]);

        $this->putJson("/api/users/{$target->id}", ['agency_id' => $new->id])->assertOk();

        $agencyIds = DB::table('user_assignments')->where('user_id', $target->id)->pluck('agency_id')->all();
        $this->assertEqualsCanonicalizing([$chiefOf->id, $new->id], $agencyIds);
    }

    public function test_update_without_agency_key_leaves_assignments_untouched(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $target = $this->userWithRole('caissier');
        $agency = Agency::factory()->create();
        $target->assignments()->attach($agency->id, ['is_primary' => false, 'is_department_chief' => false]);

        $this->putJson("/api/users/{$target->id}", ['first_name' => 'Gilles'])->assertOk();

        $this->assertSame(1, DB::table('user_assignments')->where('user_id', $target->id)->count());
    }

    public function test_update_moves_commercial_profile_agency(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $agency = Agency::factory()->create();

        $this->postJson('/api/users', [
            'username' => 'sans.agence',
            'email' => 'sans.agence@example.com',
            'first_name' => 'Sans',
            'last_name' => 'Agence',
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ])->assertCreated();
        $target = User::where('email', 'sans.agence@example.com')->first();

        $this->putJson("/api/users/{$target->id}", ['agency_id' => $agency->id])->assertOk();

        $this->assertSame($agency->id, Commercial::where('user_id', $target->id)->value('agency_id'));
    }

    public function test_department_must_belong_to_agency(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $target = $this->userWithRole('caissier');
        $agency = Agency::factory()->create();
        $other = Department::factory()->create(['agency_id' => Agency::factory()->create()->id]);

        $this->putJson("/api/users/{$target->id}", [
            'agency_id' => $agency->id,
            'department_id' => $other->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('department_id');
    }

    public function test_agency_manager_cannot_move_user_outside_scope(): void
    {
        $own = Agency::factory()->create();
        $foreign = Agency::factory()->create();
        $manager = $this->userWithRole('responsable-agence');
        $manager->assignments()->attach($own->id, ['is_primary' => true, 'is_department_chief' => false]);
        $target = $this->userWithRole('caissier');
        $target->assignments()->attach($own->id, ['is_primary' => false, 'is_department_chief' => false]);
        Sanctum::actingAs($manager);

        $this->putJson("/api/users/{$target->id}", ['agency_id' => $foreign->id])->assertForbidden();

        $this->assertSame($own->id, DB::table('user_assignments')->where('user_id', $target->id)->value('agency_id'));
    }
}
