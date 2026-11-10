<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B23 — Dans le périmètre d'une agence/d'un département, les cours globaux
 * (agency_id NULL) ne sont pas comptés : seuls les cours déployés comptent.
 */
class DepartmentAcademyScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_courses_are_excluded_from_an_agency_scope(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $agency = Agency::factory()->create();

        Course::factory()->count(14)->create(['agency_id' => $agency->id]);
        Course::factory()->count(11)->create(['agency_id' => null]);

        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $this->getJson("/api/stats/training-group?agency_id={$agency->id}")
            ->assertOk()
            ->assertJsonPath('training.summary.courses', 14)
            ->assertJsonCount(14, 'training.by_formation');

        // Sans filtre d'agence, le catalogue global reste visible (25).
        $this->getJson('/api/stats/training-group')
            ->assertOk()
            ->assertJsonPath('training.summary.courses', 25);
    }
}
