<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Role;
use App\Models\SessionModuleTrainer;
use App\Models\Trainer;
use App\Models\TrainingSession;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Page « Présences » (MVP §10) : les séances de chaque session et l'appel
 * fait (qui, quand, présents / absents), dans le périmètre de l'utilisateur.
 */
class SessionSeancesListTest extends TestCase
{
    use RefreshDatabase;

    public function test_seances_of_each_session_with_the_roll_call(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $agency = Agency::factory()->create();
        $course = Course::factory()->create(['agency_id' => $agency->id]);
        $mainUser = User::factory()->create(['role_id' => Role::where('name', 'formateur')->value('id'), 'first_name' => 'Nickson', 'last_name' => 'T']);
        $main = Trainer::create(['agency_id' => $agency->id, 'user_id' => $mainUser->id, 'first_name' => 'Nickson', 'last_name' => 'T', 'email' => 'n@example.com', 'is_active' => true]);
        $guyUser = User::factory()->create(['role_id' => Role::where('name', 'formateur')->value('id')]);
        $guy = Trainer::create(['agency_id' => $agency->id, 'user_id' => $guyUser->id, 'first_name' => 'Guy', 'last_name' => 'M', 'email' => 'g@example.com', 'is_active' => true]);

        $session = TrainingSession::factory()->create(['course_id' => $course->id, 'agency_id' => $agency->id, 'trainer_id' => $main->id]);
        $other = TrainingSession::factory()->create(['course_id' => $course->id, 'agency_id' => $agency->id, 'trainer_id' => $main->id]);
        $marketing = CourseModule::create(['course_id' => $course->id, 'name' => 'Marketing']);
        $compta = CourseModule::create(['course_id' => $course->id, 'name' => 'Compta']);
        SessionModuleTrainer::create(['training_session_id' => $session->id, 'course_module_id' => $marketing->id, 'trainer_id' => $guy->id]);

        $learners = User::factory()->count(3)->create(['role_id' => Role::where('name', 'client')->value('id')]);
        foreach (['2026-11-10' => ['present', 'present', 'absent'], '2026-11-12' => ['present', 'late', 'present']] as $date => $statuses) {
            foreach ($statuses as $i => $status) {
                Attendance::create(['training_session_id' => $session->id, 'learner_user_id' => $learners[$i]->id, 'course_module_id' => $marketing->id, 'session_date' => $date, 'status' => $status, 'recorded_by' => $mainUser->id, 'recorded_at' => now()]);
            }
        }
        Attendance::create(['training_session_id' => $session->id, 'learner_user_id' => $learners[0]->id, 'course_module_id' => $compta->id, 'session_date' => '2026-11-12', 'status' => 'present', 'recorded_by' => $mainUser->id, 'recorded_at' => now()]);

        // Responsable : toutes les sessions, chaque séance avec ses comptes.
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $rows = collect($this->getJson('/api/attendances/seances')->assertOk()->json('data'))->keyBy('id');
        $this->assertCount(2, $rows);
        $seances = collect($rows[$session->id]['seances']);
        $this->assertCount(3, $seances, '10/11 Marketing, 12/11 Marketing, 12/11 Compta');
        $day = $seances->first(fn ($s) => $s['date'] === '2026-11-10');
        $this->assertSame([3, 2, 1], [$day['total'], $day['present'], $day['absent']]);
        $this->assertSame('Nickson T', $day['recorded_by']);
        $this->assertSame([], $rows[$other->id]['seances'], 'session sans appel : listée, sans séance');

        // Formateur de module : sa session seulement, et son module seulement.
        Sanctum::actingAs($guyUser);
        $rows = collect($this->getJson('/api/attendances/seances')->assertOk()->json('data'));
        $this->assertSame([$session->id], $rows->pluck('id')->all());
        $this->assertSame(['Marketing'], collect($rows[0]['seances'])->pluck('module_name')->unique()->values()->all());
    }
}
