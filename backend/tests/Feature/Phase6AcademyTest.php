<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase6AcademyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function admin(): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function userWithRole(string $roleName): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function chief(Agency $agency): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'responsable-agence')->value('id'),
        ]);
        \Illuminate\Support\Facades\DB::table('user_assignments')->insert([
            'user_id' => $user->id,
            'agency_id' => $agency->id,
            'department_id' => null,
            'is_primary' => true,
            'is_department_chief' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function agencyIn(string $countryCode): Agency
    {
        $country = \App\Models\Country::where('code', $countryCode)->firstOrFail();
        $city = \App\Models\City::whereIn('country_id', [$country->id])->firstOrFail();

        return Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => "Agence {$country->code}",
            'type' => 'agency',
            'organization_id' => $country->organization_id,
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
        ]);
    }

    private function createCourse(array $overrides = []): array
    {
        return $this->postJson('/api/courses', array_merge([
            'name' => 'Cours de comptabilité',
            'mode' => 'in_person',
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ], $overrides))
            ->assertStatus(201)
            ->json();
    }

    private function createTrainer(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'formateur')->value('id'),
        ]);
    }

    private function createClient(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
    }

    public function test_courses_index_returns_paginated_list(): void
    {
        $this->admin();
        Course::factory()->create(['name' => 'Formation Excel']);
        Course::factory()->create(['name' => 'Formation Word']);

        $this->getJson('/api/courses')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_course_code_is_auto_generated(): void
    {
        $this->admin();
        $course = $this->createCourse();

        $this->assertNotNull($course['code']);
        $this->assertMatchesRegularExpression('/^CRS-\d{5}$/', $course['code']);
    }

    public function test_course_code_must_be_unique(): void
    {
        $this->admin();
        $this->createCourse(['code' => 'CRS-00001']);

        $this->postJson('/api/courses', [
            'name' => 'Doublon',
            'code' => 'CRS-00001',
        ])->assertStatus(422);

        $this->assertCount(1, Course::where('code', 'CRS-00001')->get());
    }

    public function test_course_invalid_mode_rejected(): void
    {
        $this->admin();

        $this->postJson('/api/courses', [
            'name' => 'Mauvais mode',
            'mode' => 'hybrid',
        ])->assertStatus(422);
    }

    public function test_course_update_and_soft_delete(): void
    {
        $this->admin();
        $course = $this->createCourse();

        $this->putJson("/api/courses/{$course['id']}", ['price' => 60000])
            ->assertOk()
            ->assertJsonPath('price', 60000);

        $this->deleteJson("/api/courses/{$course['id']}")->assertStatus(204);
        $this->assertSoftDeleted('courses', ['id' => $course['id']]);

        $this->getJson('/api/courses/trash')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->postJson("/api/courses/{$course['id']}/restore")->assertOk();
        $this->assertDatabaseHas('courses', ['id' => $course['id'], 'deleted_at' => null]);
    }

    public function test_courses_are_scoped_to_agency_for_chief(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $this->admin();
        $this->postJson('/api/courses', [
            'name' => 'Cours CMR',
            'agency_id' => $cmr->id,
        ])->assertCreated();

        $this->postJson('/api/courses', [
            'name' => 'Cours CIV',
            'agency_id' => $civ->id,
        ])->assertCreated();

        $this->postJson('/api/courses', [
            'name' => 'Cours global',
        ])->assertCreated();

        $this->chief($cmr);

        $this->getJson('/api/courses')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['name' => 'Cours CMR'])
            ->assertJsonFragment(['name' => 'Cours global']);
    }

    public function test_course_requires_permission(): void
    {
        $this->userWithRole('client');

        $this->postJson('/api/courses', ['name' => 'Interdit'])
            ->assertStatus(403);
    }

    public function test_session_creation_with_dates_and_capacity(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $trainer = $this->createTrainer();

        $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'trainer_user_id' => $trainer->id,
            'start_at' => now()->addDays(7)->toISOString(),
            'end_at' => now()->addDays(7)->addHours(4)->toISOString(),
            'location' => 'Salle 1',
            'max_capacity' => 15,
            'status' => 'planned',
        ])->assertStatus(201)
            ->assertJsonPath('max_capacity', 15)
            ->assertJsonPath('course.name', 'Cours de comptabilité')
            ->assertJsonPath('effective_price', 50000);
    }

    public function test_session_rejects_non_trainer_trainer(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'trainer_user_id' => $commercial->id,
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertStatus(422);
    }

    public function test_session_end_must_be_after_start(): void
    {
        $this->admin();
        $course = $this->createCourse();

        $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
            'end_at' => now()->addDays(1)->toISOString(),
        ])->assertStatus(422);
    }

    public function test_session_inherits_agency_from_course(): void
    {
        $this->admin();
        $cmr = $this->agencyIn('CMR');
        $course = $this->createCourse(['agency_id' => $cmr->id]);

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertStatus(201)
            ->json();

        $this->assertEquals($cmr->id, $session['agency']['id']);
    }

    public function test_session_custom_price_overrides_course_price(): void
    {
        $this->admin();
        $course = $this->createCourse(['price' => 50000]);

        $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
            'price' => 65000,
        ])->assertStatus(201)
            ->assertJsonPath('effective_price', 65000);
    }

    public function test_sessions_index_filters_by_status_and_date(): void
    {
        $this->admin();
        $course = $this->createCourse();

        TrainingSession::factory()->create([
            'course_id' => $course['id'],
            'start_at' => now()->addWeek(),
            'status' => 'planned',
        ]);
        TrainingSession::factory()->create([
            'course_id' => $course['id'],
            'start_at' => now()->subWeek(),
            'status' => 'completed',
        ]);

        $this->getJson('/api/training-sessions?status=completed')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/training-sessions?from='.now()->startOfWeek()->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_enrollment_creates_and_marks_attendance(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertStatus(201)
            ->json();

        $enrollment = $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201)
            ->assertJsonPath('status', 'enrolled')
            ->json();

        $this->assertNotNull($enrollment['id']);

        $this->putJson("/api/enrollments/{$enrollment['id']}", [
            'attendance' => true,
        ])->assertOk()
            ->assertJsonPath('attendance', true);

        $this->assertNotNull(Enrollment::find($enrollment['id'])->attended_at);
    }

    public function test_enrollment_rejects_non_client_learner(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $commercial->id,
        ])->assertStatus(422);
    }

    public function test_enrollment_duplicate_rejected(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(409);
    }

    public function test_full_session_rejects_enrollment(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
            'max_capacity' => 1,
        ])->assertCreated()
            ->json();

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $other = $this->createClient();

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $other->id,
        ])->assertStatus(409);
    }

    public function test_enrollments_index_filters_by_session(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $this->getJson('/api/enrollments?session_id='.$session['id'])
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.learner.id', $client->id);
    }

    public function test_training_report_aggregates(): void
    {
        $this->admin();
        $course = $this->createCourse(['price' => 50000]);
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/enrollments', [
            'session_id' => $session['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $this->getJson('/api/reports/training')
            ->assertOk()
            ->assertJsonPath('summary.courses', 1)
            ->assertJsonPath('summary.sessions', 1)
            ->assertJsonPath('summary.enrollments', 1)
            ->assertJsonPath('summary.potential_revenue', 50000)
            ->assertJsonPath('data.0.report.enrollments_enrolled', 1);
    }

    public function test_sessions_scoped_for_chief(): void
    {
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $this->admin();
        $courseCmr = $this->createCourse(['name' => 'Cours CMR', 'agency_id' => $cmr->id]);
        $courseCiv = $this->createCourse(['name' => 'Cours CIV', 'agency_id' => $civ->id]);

        $this->postJson('/api/training-sessions', [
            'course_id' => $courseCmr['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated();

        $this->postJson('/api/training-sessions', [
            'course_id' => $courseCiv['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated();

        $this->chief($cmr);

        $this->getJson('/api/training-sessions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.course.name', 'Cours CMR');
    }
}