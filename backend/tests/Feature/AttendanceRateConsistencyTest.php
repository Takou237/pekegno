<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\FormationEnrollment;
use App\Models\Role;
use App\Models\SessionParticipant;
use App\Models\Trainer;
use App\Models\TrainingSession;
use App\Models\User;
use App\Services\AcademyReportService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B22 — un seul taux de présence : présents / attendus, sur les séances PASSÉES.
 *
 * Jeu de données : 2 apprenants inscrits, 2 séances passées, 1 séance annulée et
 * 1 séance à venir. Un apprenant est pointé deux fois (deux modules) sur la même
 * séance : il ne doit compter qu'une fois.
 *
 * Attendus = 2 apprenants × 2 séances passées = 4 ; présents = 3 → 75 %.
 * La même valeur doit sortir du rapport académie, du rapport des sessions et de
 * l'espace formateur (et du tableau de bord groupe).
 */
class AttendanceRateConsistencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-10 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function learner(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
    }

    private function makeSession(Course $course, Trainer $trainer, Agency $agency, string $startAt, string $status): TrainingSession
    {
        return TrainingSession::factory()->create([
            'course_id' => $course->id,
            'trainer_id' => $trainer->id,
            'agency_id' => $agency->id,
            'start_at' => $startAt.' 09:00:00',
            'end_at' => $startAt.' 11:00:00',
            'status' => $status,
        ]);
    }

    private function enroll(Course $course, User $learner): FormationEnrollment
    {
        return FormationEnrollment::create([
            'course_id' => $course->id,
            'learner_user_id' => $learner->id,
            'enrolled_at' => '2026-10-01 09:00:00',
            'status' => FormationEnrollment::STATUS_ENROLLED,
        ]);
    }

    private function participate(TrainingSession $session, FormationEnrollment $enrollment): void
    {
        SessionParticipant::create([
            'training_session_id' => $session->id,
            'formation_enrollment_id' => $enrollment->id,
            'status' => 'enrolled',
        ]);
    }

    private function attend(TrainingSession $session, User $learner, ?CourseModule $module, string $status): void
    {
        Attendance::create([
            'training_session_id' => $session->id,
            'learner_user_id' => $learner->id,
            'course_module_id' => $module?->id,
            'status' => $status,
            'recorded_at' => $session->start_at,
        ]);
    }

    public function test_presence_rate_is_present_over_expected_on_past_sessions_on_every_screen(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $agency = Agency::factory()->create();
        $trainer = Trainer::create([
            'agency_id' => $agency->id,
            'first_name' => 'Awa',
            'last_name' => 'Nkomo',
            'email' => 'awa.nkomo@example.com',
            'is_active' => true,
        ]);

        $course = Course::factory()->create(['agency_id' => $agency->id]);
        $moduleOne = CourseModule::create(['course_id' => $course->id, 'name' => 'Module 1']);
        $moduleTwo = CourseModule::create(['course_id' => $course->id, 'name' => 'Module 2']);

        $learnerA = $this->learner();
        $learnerB = $this->learner();
        $enrollmentA = $this->enroll($course, $learnerA);
        $enrollmentB = $this->enroll($course, $learnerB);

        $pastOne = $this->makeSession($course, $trainer, $agency, '2026-11-02', 'completed');
        $pastTwo = $this->makeSession($course, $trainer, $agency, '2026-11-05', 'completed');
        $cancelled = $this->makeSession($course, $trainer, $agency, '2026-11-03', 'cancelled');
        $future = $this->makeSession($course, $trainer, $agency, '2026-11-20', 'planned');

        foreach ([$pastOne, $pastTwo, $cancelled, $future] as $session) {
            $this->participate($session, $enrollmentA);
            $this->participate($session, $enrollmentB);
        }

        // Séance 1 : apprenant A pointé sur les deux modules (il compte une fois),
        // apprenant B absent.
        $this->attend($pastOne, $learnerA, $moduleOne, Attendance::STATUS_PRESENT);
        $this->attend($pastOne, $learnerA, $moduleTwo, Attendance::STATUS_PRESENT);
        $this->attend($pastOne, $learnerB, $moduleOne, Attendance::STATUS_ABSENT);

        // Séance 2 : les deux apprenants présents.
        $this->attend($pastTwo, $learnerA, null, Attendance::STATUS_PRESENT);
        $this->attend($pastTwo, $learnerB, null, Attendance::STATUS_PRESENT);

        // Ni la séance annulée ni la séance à venir n'entrent dans le calcul.
        $this->attend($cancelled, $learnerA, null, Attendance::STATUS_PRESENT);
        $this->attend($future, $learnerA, null, Attendance::STATUS_PRESENT);

        // 1) Rapport académie (source unique des cartes du tableau de bord).
        $report = app(AcademyReportService::class)->groupStats(null);
        $row = collect($report['by_formation'])->firstWhere('id', $course->id);

        $this->assertSame(3, $row['attendance_count']);
        $this->assertSame(4, $row['attendance_expected']);
        $this->assertSame(75.0, $row['attendance_rate']);
        $this->assertSame(75.0, $report['avg_attendance']);

        // 2) Rapport des sessions / planning.
        $this->getJson('/api/reports/training')
            ->assertOk()
            ->assertJsonPath('data.0.report.attendance_count', 3)
            ->assertJsonPath('data.0.report.attendance_expected', 4)
            ->assertJsonPath('data.0.report.attendance_rate', 75)
            // Le résumé exposé au front porte le même taux (plus de recalcul local).
            ->assertJsonPath('summary.attendance_expected', 4)
            ->assertJsonPath('summary.attendance_rate', 75);

        // 3) Espace formateur (statistiques du formateur).
        $this->getJson("/api/trainers/{$trainer->id}/stats")
            ->assertOk()
            ->assertJsonPath('stats.attendance_count', 3)
            ->assertJsonPath('stats.attendance_expected', 4)
            ->assertJsonPath('stats.attendance_rate', 75);

        // Tableau de bord académie au niveau du groupe.
        $this->getJson('/api/stats/training-group')
            ->assertOk()
            ->assertJsonPath('training.avg_attendance', 75);
    }

    public function test_rate_stays_zero_when_no_session_has_happened_yet(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $agency = Agency::factory()->create();
        $trainer = Trainer::create([
            'agency_id' => $agency->id,
            'first_name' => 'Awa',
            'last_name' => 'Nkomo',
            'email' => 'awa.nkomo@example.com',
            'is_active' => true,
        ]);
        $course = Course::factory()->create(['agency_id' => $agency->id]);

        $learner = $this->learner();
        $enrollment = $this->enroll($course, $learner);

        $future = $this->makeSession($course, $trainer, $agency, '2026-11-20', 'planned');
        $this->participate($future, $enrollment);
        $this->attend($future, $learner, null, Attendance::STATUS_PRESENT);

        $report = app(AcademyReportService::class)->groupStats(null);
        $row = collect($report['by_formation'])->firstWhere('id', $course->id);

        $this->assertSame(0, $row['attendance_expected']);
        $this->assertSame(0.0, $row['attendance_rate']);
        // Aucune présence attendue : « pas de donnée », pas « 0 % de présence ».
        $this->assertNull($report['avg_attendance']);
    }
}
