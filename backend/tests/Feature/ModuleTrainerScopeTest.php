<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\FormationEnrollment;
use App\Models\Role;
use App\Models\SessionParticipant;
use App\Models\Trainer;
use App\Models\TrainingSession;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Un module peut avoir son propre formateur (facultatif). Ce formateur voit
 * les sessions de la formation, mais seulement son module : ses apprenants,
 * son appel, jamais les autres modules ni les montants. Le formateur
 * principal de la session continue de tout voir.
 */
class ModuleTrainerScopeTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function trainer(Agency $agency): array
    {
        $this->seq++;
        $user = User::factory()->create(['role_id' => Role::where('name', 'formateur')->value('id')]);
        $trainer = Trainer::create(['agency_id' => $agency->id, 'user_id' => $user->id, 'first_name' => 'F'.$this->seq, 'last_name' => 'T', 'email' => "f{$this->seq}@example.com", 'is_active' => true]);

        return [$user, $trainer];
    }

    private function participant(Course $course, TrainingSession $session): User
    {
        $learner = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);
        $enrollment = FormationEnrollment::create(['course_id' => $course->id, 'learner_user_id' => $learner->id, 'enrolled_at' => now(), 'status' => FormationEnrollment::STATUS_ENROLLED]);
        SessionParticipant::create(['training_session_id' => $session->id, 'formation_enrollment_id' => $enrollment->id, 'status' => 'enrolled']);

        return $learner;
    }

    public function test_module_trainer_only_sees_his_module_and_his_learners(): void
    {
        $agency = Agency::factory()->create();
        [$mainUser, $main] = $this->trainer($agency);
        [$moduleUser, $moduleTrainer] = $this->trainer($agency);

        $course = Course::factory()->create(['agency_id' => $agency->id]);
        $mine = CourseModule::create(['course_id' => $course->id, 'name' => 'Marketing digital']);
        $other = CourseModule::create(['course_id' => $course->id, 'name' => 'Comptabilité']); // sans formateur : facultatif
        $session = TrainingSession::factory()->create(['course_id' => $course->id, 'trainer_id' => $main->id, 'agency_id' => $agency->id, 'price' => 150000]);
        // Autre session de la MÊME formation : il n'y a pas de module confié.
        $sibling = TrainingSession::factory()->create(['course_id' => $course->id, 'trainer_id' => $main->id, 'agency_id' => $agency->id]);
        $learner = $this->participant($course, $session);
        $siblingLearner = $this->participant($course, $sibling);

        // Le responsable confie le module « Marketing digital » de CETTE session.
        $admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($admin);
        $this->putJson("/api/training-sessions/{$session->id}/module-trainers", ['assignments' => [
            ['course_module_id' => $mine->id, 'trainer_id' => $moduleTrainer->id],
            ['course_module_id' => $other->id, 'trainer_id' => null],
        ]])->assertOk()->assertJsonPath('0.trainer.id', $moduleTrainer->id)->assertJsonPath('1.trainer', null);

        // Autre formation, sans lien avec lui.
        $otherCourse = Course::factory()->create(['agency_id' => $agency->id]);
        $foreignSession = TrainingSession::factory()->create(['course_id' => $otherCourse->id, 'trainer_id' => $main->id, 'agency_id' => $agency->id]);
        $stranger = $this->participant($otherCourse, $foreignSession);

        Sanctum::actingAs($moduleUser);

        // Sessions : seulement celle où son module lui est confié (pas les
        // autres sessions de la même formation) ; sans montant.
        $ids = collect($this->getJson('/api/training-sessions?per_page=100')->assertOk()->json('data'))->pluck('id');
        $this->assertEquals([$session->id], $ids->all());
        $this->getJson("/api/training-sessions/{$foreignSession->id}")->assertNotFound();
        $this->getJson("/api/training-sessions/{$sibling->id}")->assertNotFound();
        $this->getJson("/api/training-sessions/{$sibling->id}/attendances?course_module_id={$mine->id}")->assertForbidden();
        $this->assertNull($this->getJson("/api/training-sessions/{$session->id}")->assertOk()->json('data.price'));

        // Modules : seulement le sien (dans cette session).
        $modules = collect($this->getJson("/api/courses/{$course->id}/modules")->assertOk()->json())->pluck('id');
        $this->assertEquals([$mine->id], $modules->all());
        $this->assertSame([], $this->getJson("/api/courses/{$course->id}/modules?training_session_id={$sibling->id}")->assertOk()->json());

        // Appel : son module seulement.
        $this->getJson("/api/training-sessions/{$session->id}/attendances")->assertForbidden();
        $this->getJson("/api/training-sessions/{$session->id}/attendances?course_module_id={$other->id}")->assertForbidden();
        $this->getJson("/api/training-sessions/{$session->id}/attendances?course_module_id={$mine->id}")->assertOk();
        $this->putJson("/api/training-sessions/{$session->id}/attendances", [
            'course_module_id' => $mine->id,
            'attendances' => [['learner_user_id' => $learner->id, 'status' => 'present']],
        ])->assertOk();
        $this->putJson("/api/training-sessions/{$session->id}/attendances", [
            'course_module_id' => $other->id,
            'attendances' => [['learner_user_id' => $learner->id, 'status' => 'present']],
        ])->assertForbidden();

        // Ses apprenants seulement.
        $learnerIds = collect($this->getJson('/api/learners?as_trainer=1&per_page=100')->assertOk()->json('data'))->pluck('id');
        $this->assertContains($learner->id, $learnerIds->all());
        $this->assertNotContains($stranger->id, $learnerIds->all());
        $this->assertNotContains($siblingLearner->id, $learnerIds->all());

        // Son espace : la session apparaît avec son module.
        $row = collect($this->getJson('/api/trainers/me/stats')->assertOk()->json('all_sessions'))->firstWhere('id', $session->id);
        $this->assertFalse($row['is_main_trainer']);
        $this->assertSame(['Marketing digital'], collect($row['my_modules'])->pluck('name')->all());
        $this->assertNull(collect($this->getJson('/api/trainers/me/stats')->json('all_sessions'))->firstWhere('id', $sibling->id));

        // Le formateur principal voit toute la session et tous les modules.
        Sanctum::actingAs($mainUser);
        $this->assertCount(2, $this->getJson("/api/courses/{$course->id}/modules")->json());
        $this->getJson("/api/training-sessions/{$session->id}/attendances")->assertOk();
    }
}
