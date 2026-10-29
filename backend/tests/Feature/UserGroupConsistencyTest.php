<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ce que fait le groupe sur un compte (suppression, changement d'agence,
 * modification) doit se refléter dans les vues pays et agence.
 */
class UserGroupConsistencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Sanctum::actingAs($this->userWithRole('super-admin'));
    }

    private function userWithRole(string $role, array $attributes = []): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ] + $attributes);
    }

    public function test_deleting_user_archives_its_employee_and_trainer_profiles(): void
    {
        $agency = Agency::factory()->create();
        $employee = $this->userWithRole('caissier');
        $trainer = $this->userWithRole('formateur');
        $commercial = Commercial::create([
            'user_id' => $employee->id, 'agency_id' => $agency->id, 'kind' => 'employe',
            'first_name' => 'Gilles', 'last_name' => 'Gnaore', 'is_active' => true,
        ]);
        $trainerProfile = Trainer::create([
            'user_id' => $trainer->id, 'agency_id' => $agency->id,
            'first_name' => 'Fanny', 'last_name' => 'Formatrice', 'is_active' => true,
        ]);

        $this->deleteJson("/api/users/{$employee->id}")->assertNoContent();
        $this->deleteJson("/api/users/{$trainer->id}")->assertNoContent();

        $this->assertSoftDeleted('commercials', ['id' => $commercial->id]);
        $this->assertSoftDeleted('trainers', ['id' => $trainerProfile->id]);
        $this->getJson("/api/commercials?kind=employe&agency_id={$agency->id}")
            ->assertOk()
            ->assertJsonMissing(['id' => $commercial->id]);
    }

    public function test_moving_trainer_moves_its_trainer_profile(): void
    {
        $old = Agency::factory()->create();
        $new = Agency::factory()->create();
        $trainer = $this->userWithRole('formateur');
        $trainer->assignments()->attach($old->id, ['is_primary' => false, 'is_department_chief' => false]);
        $profile = Trainer::create([
            'user_id' => $trainer->id, 'agency_id' => $old->id,
            'first_name' => 'Fanny', 'last_name' => 'Formatrice', 'is_active' => true,
        ]);

        $this->putJson("/api/users/{$trainer->id}", ['agency_id' => $new->id])->assertOk();

        $this->assertSame($new->id, $profile->fresh()->agency_id);
    }

    public function test_updating_user_refreshes_profile_identity(): void
    {
        $employee = $this->userWithRole('caissier');
        $commercial = Commercial::create([
            'user_id' => $employee->id, 'kind' => 'employe',
            'first_name' => 'Ancien', 'last_name' => 'Nom', 'email' => 'ancien@example.com', 'is_active' => true,
        ]);

        $this->putJson("/api/users/{$employee->id}", [
            'first_name' => 'Nouveau',
            'email' => 'nouveau@example.com',
            'is_active' => false,
        ])->assertOk();

        $commercial->refresh();
        $this->assertSame('Nouveau', $commercial->first_name);
        $this->assertSame('nouveau@example.com', $commercial->email);
        $this->assertFalse((bool) $commercial->is_active);
    }

    public function test_country_filter_lists_only_that_country_users(): void
    {
        $cameroun = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF', 'is_active' => true]);
        $ivoire = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF', 'is_active' => true]);
        $douala = Agency::factory()->create(['country_id' => $cameroun->id]);
        $bouake = Agency::factory()->create(['country_id' => $ivoire->id]);
        $inCameroun = $this->userWithRole('caissier');
        $inCameroun->assignments()->attach($douala->id, ['is_primary' => false, 'is_department_chief' => false]);
        $inIvoire = $this->userWithRole('caissier');
        $inIvoire->assignments()->attach($bouake->id, ['is_primary' => false, 'is_department_chief' => false]);
        $director = $this->userWithRole('direction-generale', ['country_id' => $cameroun->id]);

        $ids = collect($this->getJson("/api/users?country_id={$cameroun->id}")->assertOk()->json('data'))
            ->pluck('id')->all();

        $this->assertEqualsCanonicalizing([$inCameroun->id, $director->id], $ids);
    }
}
