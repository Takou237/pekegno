<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Attendance;
use App\Models\Country;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Role;
use App\Models\SessionParticipant;
use App\Models\TrainingSession;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Lot 7 — Présences par séance datée (MVP §10, CdC §7).
 */
class SessionAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private TrainingSession $session;
    private User $learner1;
    private User $learner2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);

        $adminRole = Role::where('name', 'super-admin')->first();
        $this->admin = User::factory()->create([
            'role_id' => $adminRole->id,
            'email' => 'admin@pekegno.test',
        ]);

        $country = Country::create([
            'name' => 'Cameroun',
            'code' => 'CM',
            'currency_code' => 'XAF',
            'exchange_rate' => 1.0,
            'phone_code' => '237',
        ]);

        $agency = Agency::create([
            'name' => 'Douala',
            'code' => 'DLA',
            'country_id' => $country->id,
            'country' => 'Cameroun',
            'city' => 'Douala',
        ]);

        $course = Course::factory()->create([
            'name' => 'Design Graphique Pro',
        ]);

        $this->session = TrainingSession::create([
            'course_id' => $course->id,
            'agency_id' => $agency->id,
            'start_at' => '2026-11-01 09:00:00',
            'end_at' => '2026-11-30 17:00:00',
            'status' => 'ongoing',
        ]);

        $this->learner1 = User::factory()->create(['first_name' => 'Jean', 'last_name' => 'Dupont']);
        $this->learner2 = User::factory()->create(['first_name' => 'Alice', 'last_name' => 'Martin']);

        $enr1 = FormationEnrollment::create([
            'learner_user_id' => $this->learner1->id,
            'course_id' => $course->id,
            'status' => 'validated',
            'requested_session_id' => $this->session->id,
            'enrolled_at' => now(),
        ]);
        SessionParticipant::create([
            'training_session_id' => $this->session->id,
            'formation_enrollment_id' => $enr1->id,
            'status' => 'enrolled',
        ]);

        $enr2 = FormationEnrollment::create([
            'learner_user_id' => $this->learner2->id,
            'course_id' => $course->id,
            'status' => 'validated',
            'requested_session_id' => $this->session->id,
            'enrolled_at' => now(),
        ]);
        SessionParticipant::create([
            'training_session_id' => $this->session->id,
            'formation_enrollment_id' => $enr2->id,
            'status' => 'enrolled',
        ]);
    }

    public function test_attendance_can_be_recorded_for_specific_session_dates(): void
    {
        $this->actingAs($this->admin);

        // Séance 1 : 2026-11-05 -> Jean présent, Alice absente
        $this->putJson("/api/training-sessions/{$this->session->id}/attendances", [
            'session_date' => '2026-11-05',
            'attendances' => [
                ['learner_user_id' => $this->learner1->id, 'status' => 'present'],
                ['learner_user_id' => $this->learner2->id, 'status' => 'absent'],
            ],
        ])->assertOk();

        // Séance 2 : 2026-11-08 -> Jean absent, Alice présente
        $this->putJson("/api/training-sessions/{$this->session->id}/attendances", [
            'session_date' => '2026-11-08',
            'attendances' => [
                ['learner_user_id' => $this->learner1->id, 'status' => 'absent'],
                ['learner_user_id' => $this->learner2->id, 'status' => 'present'],
            ],
        ])->assertOk();

        // Vérification de la séance 1 (2026-11-05)
        $res1 = $this->getJson("/api/training-sessions/{$this->session->id}/attendances?session_date=2026-11-05")
            ->assertOk()
            ->json('attendances');

        $byLearner1 = collect($res1)->keyBy('learner_user_id');
        $this->assertSame('present', $byLearner1[$this->learner1->id]['status']);
        $this->assertSame('absent', $byLearner1[$this->learner2->id]['status']);

        // Vérification de la séance 2 (2026-11-08)
        $res2 = $this->getJson("/api/training-sessions/{$this->session->id}/attendances?session_date=2026-11-08")
            ->assertOk()
            ->json('attendances');

        $byLearner2 = collect($res2)->keyBy('learner_user_id');
        $this->assertSame('absent', $byLearner2[$this->learner1->id]['status']);
        $this->assertSame('present', $byLearner2[$this->learner2->id]['status']);
    }
}
