<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Course;
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
 * Espace formateur : effectifs calculés sur les sessions du formateur, liste et
 * fiche des apprenants de ses sessions, et accès « Mes formations » pour un
 * compte non formateur (community manager, commercial) lié à un profil formateur.
 */
class LinkedTrainerSpaceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function trainerFor(User $user): Trainer
    {
        return Trainer::create([
            'user_id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'is_active' => true,
        ]);
    }

    private function enroll(Course $course, ?TrainingSession $session, string $status = 'enrolled'): User
    {
        $learner = $this->user('client');
        $enrollment = FormationEnrollment::create([
            'course_id' => $course->id,
            'learner_user_id' => $learner->id,
            'enrolled_at' => now(),
            'status' => $status,
        ]);

        if ($session) {
            SessionParticipant::create([
                'training_session_id' => $session->id,
                'formation_enrollment_id' => $enrollment->id,
                'status' => 'enrolled',
            ]);
        }

        return $learner;
    }

    /**
     * Formation avec deux sessions : celle du formateur (aucun participant) et
     * celle d'un autre formateur (un participant) + un inscrit sans session.
     */
    private function scenario(Trainer $trainer): array
    {
        $agency = Agency::factory()->create();
        $course = Course::factory()->create(['price' => 15000, 'agency_id' => $agency->id]);
        $mine = TrainingSession::factory()->create(['course_id' => $course->id, 'trainer_id' => $trainer->id, 'agency_id' => $agency->id]);
        $other = TrainingSession::factory()->create(['course_id' => $course->id, 'agency_id' => $agency->id]);

        $otherLearner = $this->enroll($course, $other);
        $this->enroll($course, null, FormationEnrollment::STATUS_PENDING);

        return [$course, $mine, $other, $otherLearner];
    }

    public function test_trainer_stats_count_only_participants_of_his_sessions(): void
    {
        $formateur = $this->user('formateur');
        [, $mine] = $this->scenario($this->trainerFor($formateur));

        Sanctum::actingAs($formateur);
        $data = $this->getJson('/api/trainers/me/stats')->assertOk()->json();

        $this->assertSame(0, $data['stats']['learners_unique']);
        $this->assertSame(0, $data['stats']['enrollments_enrolled']);
        $this->assertSame(0, collect($data['recent_sessions'])->firstWhere('id', $mine->id)['enrollments_count']);

        $learner = $this->enroll($mine->course, $mine);

        $data = $this->getJson('/api/trainers/me/stats')->assertOk()->json();
        $this->assertSame(1, $data['stats']['learners_unique']);
        $this->assertSame(1, collect($data['recent_sessions'])->firstWhere('id', $mine->id)['enrollments_count']);

        $learners = $this->getJson('/api/learners?as_trainer=1')->assertOk()->json('data');
        $this->assertSame([$learner->id], collect($learners)->pluck('learner.id')->all());
    }

    public function test_trainer_can_open_learner_sheet_limited_to_his_sessions(): void
    {
        $formateur = $this->user('formateur');
        [$course, $mine, $other] = $this->scenario($this->trainerFor($formateur));
        $learner = $this->enroll($course, $mine);

        // Le même apprenant suit aussi la session d'un autre formateur.
        SessionParticipant::create([
            'training_session_id' => $other->id,
            'formation_enrollment_id' => FormationEnrollment::where('learner_user_id', $learner->id)->value('id'),
            'status' => 'enrolled',
        ]);

        Sanctum::actingAs($formateur);
        $stats = $this->getJson("/api/learners/{$learner->id}/stats?as_trainer=1")->assertOk()->json();

        $mineParticipantId = SessionParticipant::where('training_session_id', $mine->id)->value('id');
        $this->assertSame([$mineParticipantId], collect($stats['upcoming_sessions'])->pluck('id')->all());
    }

    public function test_community_manager_linked_to_trainer_profile_gets_trainer_space(): void
    {
        $cm = $this->user('community-manager');
        Commercial::factory()->create(['user_id' => $cm->id, 'agency_id' => Agency::factory()->create()->id]);
        $this->trainerFor($cm);

        Sanctum::actingAs($cm);
        $this->getJson('/api/user')->assertOk()->assertJsonPath('has_trainer_profile', true);
        $this->getJson('/api/trainers/me/stats')->assertOk();
        $this->getJson('/api/learners?as_trainer=1')->assertOk();
    }

    public function test_commercial_without_trainer_profile_has_no_trainer_space(): void
    {
        $commercial = $this->user('commercial');
        Commercial::factory()->create(['user_id' => $commercial->id, 'agency_id' => Agency::factory()->create()->id]);

        Sanctum::actingAs($commercial);
        $this->getJson('/api/user')->assertOk()->assertJsonPath('has_trainer_profile', false);

        // Aucun profil formateur n'est créé à la volée pour un non-formateur.
        $this->getJson('/api/trainers/me/stats')->assertNotFound();
        $this->assertFalse(Trainer::where('user_id', $commercial->id)->exists());

        $this->assertSame([], $this->getJson('/api/learners?as_trainer=1')->assertOk()->json('data'));
    }

    public function test_linked_trainer_can_record_attendance_of_his_session_only(): void
    {
        $cm = $this->user('community-manager');
        Commercial::factory()->create(['user_id' => $cm->id, 'agency_id' => Agency::factory()->create()->id]);
        [$course, $mine, $other] = $this->scenario($this->trainerFor($cm));
        $learner = $this->enroll($course, $mine);
        $payload = ['attendances' => [['learner_user_id' => $learner->id, 'status' => 'present']]];

        Sanctum::actingAs($cm);
        $this->getJson("/api/training-sessions/{$mine->id}/attendances")->assertOk();
        $this->putJson("/api/training-sessions/{$mine->id}/attendances", $payload)->assertOk();
        $this->assertDatabaseHas('attendances', [
            'training_session_id' => $mine->id,
            'learner_user_id' => $learner->id,
            'status' => 'present',
        ]);

        // Session d'un autre formateur : pas de saisie.
        $this->putJson("/api/training-sessions/{$other->id}/attendances", $payload)->assertForbidden();

        // Commercial sans profil formateur : pas de saisie non plus.
        $commercial = $this->user('commercial');
        Sanctum::actingAs($commercial);
        $this->putJson("/api/training-sessions/{$mine->id}/attendances", $payload)->assertForbidden();
    }

    public function test_trainer_stats_return_all_sessions_beyond_overview_limit(): void
    {
        $formateur = $this->user('formateur');
        $trainer = $this->trainerFor($formateur);
        $course = Course::factory()->create();

        TrainingSession::factory()->count(7)->create(['course_id' => $course->id, 'trainer_id' => $trainer->id, 'start_at' => now()->addDays(3)]);
        TrainingSession::factory()->count(2)->create(['course_id' => $course->id, 'trainer_id' => $trainer->id, 'start_at' => now()->subDays(3), 'status' => 'completed']);

        Sanctum::actingAs($formateur);
        $data = $this->getJson('/api/trainers/me/stats')->assertOk()->json();

        $this->assertCount(5, $data['recent_sessions']);
        $this->assertCount(5, $data['upcoming_sessions']);
        $this->assertCount(9, $data['all_sessions']);
        $this->assertCount(7, $data['all_upcoming_sessions']);
        $this->assertSame(7, $data['stats']['sessions_upcoming']);
    }
}
