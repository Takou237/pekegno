<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\CourseCategory;
use App\Models\Invoice;
use App\Models\Promotion;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\TrainingSession;
use App\Models\Trainer;
use App\Models\TreasuryAccount;
use App\Models\User;
use App\Services\PointsService;
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

    private function createTrainer(): Trainer
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'formateur')->value('id'),
        ]);

        return Trainer::create([
            'user_id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => true,
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

    public function test_course_enrollment_count_excludes_cancelled(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertCreated();

        $this->getJson('/api/courses')
            ->assertJsonPath('data.0.formation_enrollments_count', 1);

        $enrollment = \App\Models\FormationEnrollment::where('course_id', $course['id'])->first();

        $this->deleteJson("/api/formation-enrollments/{$enrollment->id}")->assertNoContent();

        $this->getJson('/api/courses')
            ->assertJsonPath('data.0.formation_enrollments_count', 0);
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
            'trainer_id' => $trainer->id,
            'start_at' => now()->addDays(7)->toISOString(),
            'end_at' => now()->addDays(7)->addHours(4)->toISOString(),
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
            'trainer_id' => $commercial->id,
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

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201)
            ->assertJsonPath('status', 'enrolled')
            ->json();

        $this->assertNotNull($enrollment['id']);

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $session['id'],
            'formation_enrollment_id' => $enrollment['id'],
            'status' => 'enrolled',
        ]);

        $this->putJson("/api/training-sessions/{$session['id']}/attendances", [
            'attendances' => [['learner_user_id' => $client->id, 'status' => 'present']],
        ])->assertOk()
            ->assertJsonPath('attendances.0.status', 'present');

        $this->assertDatabaseHas('attendances', [
            'training_session_id' => $session['id'],
            'learner_user_id' => $client->id,
            'status' => 'present',
        ]);
    }

    public function test_deleting_session_removes_participants_and_attendances(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $this->putJson("/api/training-sessions/{$session['id']}/attendances", [
            'attendances' => [['learner_user_id' => $client->id, 'status' => 'present']],
        ])->assertOk();

        $this->deleteJson("/api/training-sessions/{$session['id']}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('session_participants', [
            'training_session_id' => $session['id'],
        ]);
        $this->assertDatabaseMissing('attendances', [
            'training_session_id' => $session['id'],
        ]);

        $this->getJson("/api/learners/{$client->id}/stats")
            ->assertOk()
            ->assertJsonPath('stats.enrollments_total', 0);
    }

    public function test_learner_stats_exclude_participants_of_soft_deleted_session(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertCreated();

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $session['id'],
        ]);

        // Suppression douce : le participant subsiste, mais la session n'est plus visible.
        TrainingSession::find($session['id'])->delete();

        $this->getJson("/api/learners/{$client->id}/stats")
            ->assertOk()
            ->assertJsonPath('stats.enrollments_total', 0)
            ->assertJsonCount(0, 'recent_enrollments');
    }

    public function test_attendance_sheet_has_no_default_status_until_marked(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        // Aucun statut par défaut : la feuille arrive sans coche.
        $this->getJson("/api/training-sessions/{$session['id']}/attendances")
            ->assertOk()
            ->assertJsonCount(1, 'attendances')
            ->assertJsonPath('attendances.0.status', null);

        // Une fois marqué, le statut est enregistré.
        $this->putJson("/api/training-sessions/{$session['id']}/attendances", [
            'attendances' => [['learner_user_id' => $client->id, 'status' => 'present']],
        ])->assertOk()
            ->assertJsonCount(1, 'attendances')
            ->assertJsonPath('attendances.0.status', 'present');
    }

    public function test_enrollment_rejects_non_client_learner(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $commercial = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $commercial->id,
        ])->assertStatus(422);
    }

    public function test_enrollment_duplicate_rejected(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(409);
    }

    public function test_full_session_keeps_enrollment_without_slot(): void
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

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $other = $this->createClient();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $other->id,
        ])->assertStatus(201);

        // L'inscription reste valide, mais n'occupe pas la session au complet.
        $this->assertSame(
            1,
            \Illuminate\Support\Facades\DB::table('session_participants')->where('training_session_id', $session['id'])->count()
        );
    }

    public function test_enrollment_with_selected_session_assigns_only_to_that_session(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $first = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()->json();

        $second = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(21)->toISOString(),
        ])->assertCreated()->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'training_session_id' => $first['id'],
        ])->assertStatus(201);

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $first['id'],
            'status' => 'enrolled',
        ]);
        $this->assertDatabaseMissing('session_participants', [
            'training_session_id' => $second['id'],
        ]);
    }

    public function test_enrollment_rejects_session_from_another_course(): void
    {
        $this->admin();
        $courseA = $this->createCourse();
        $courseB = $this->createCourse();
        $client = $this->createClient();

        $sessionB = $this->postJson('/api/training-sessions', [
            'course_id' => $courseB['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $courseA['id'],
            'learner_user_id' => $client->id,
            'training_session_id' => $sessionB['id'],
        ])->assertStatus(422);
    }

    public function test_enrollment_rejects_selected_full_session(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $first = $this->createClient();
        $second = $this->createClient();

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
            'max_capacity' => 1,
        ])->assertCreated()->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $first->id,
            'training_session_id' => $session['id'],
        ])->assertStatus(201);

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $second->id,
            'training_session_id' => $session['id'],
        ])->assertStatus(422);
    }

    public function test_enrollments_index_filters_by_learner(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        $this->getJson('/api/formation-enrollments?learner_user_id='.$client->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.learner.id', $client->id);
    }

    public function test_deleted_enrollment_is_hidden_by_default_but_findable_when_cancelled(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201)
            ->json();

        $this->deleteJson('/api/formation-enrollments/'.$enrollment['id'])->assertStatus(204);

        // Régression : une inscription supprimée ne doit pas « réapparaître »
        // dans la liste par défaut (seulement via le filtre status=cancelled).
        $this->getJson('/api/formation-enrollments')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/formation-enrollments?status=cancelled')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'cancelled');
    }

    public function test_reenrollment_reactivates_participant_on_started_session(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $session = TrainingSession::factory()->create([
            'course_id' => $course['id'],
            'start_at' => now()->subHour(),
            'end_at' => now()->addHours(3),
            'status' => 'planned',
        ]);

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertCreated()
            ->json();

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $session->id,
            'formation_enrollment_id' => $enrollment['id'],
            'status' => 'enrolled',
        ]);

        $this->deleteJson('/api/formation-enrollments/'.$enrollment['id'])->assertNoContent();

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $session->id,
            'formation_enrollment_id' => $enrollment['id'],
            'status' => 'cancelled',
        ]);

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertCreated();

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $session->id,
            'formation_enrollment_id' => $enrollment['id'],
            'status' => 'enrolled',
        ]);

        $this->getJson('/api/training-sessions')
            ->assertOk()
            ->assertJsonPath('data.0.enrollments_count', 1);
    }

    public function test_enrollment_never_attaches_to_ended_sessions(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $ended = TrainingSession::factory()->create([
            'course_id' => $course['id'],
            'start_at' => now()->subWeek(),
            'end_at' => now()->subWeek()->addHours(2),
            'status' => 'completed',
        ]);

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertCreated();

        $this->assertDatabaseMissing('session_participants', [
            'training_session_id' => $ended->id,
        ]);
    }

    public function test_session_creation_does_not_auto_assign_existing_enrollments(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $first = $this->createClient();
        $second = $this->createClient();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $first->id,
        ])->assertCreated();
        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $second->id,
        ])->assertCreated();

        // Depuis que l'inscription choisit explicitement sa session,
        // une nouvelle session démarre vide : pas d'affectation automatique.
        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
            'end_at' => now()->addDays(7)->addHours(4)->toISOString(),
            'max_capacity' => 1,
        ])->assertCreated()
            ->json();

        $this->assertSame(
            0,
            \Illuminate\Support\Facades\DB::table('session_participants')->where('training_session_id', $session['id'])->count()
        );
    }

    public function test_session_creation_ignores_module_selection(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $module = \App\Models\CourseModule::create([
            'course_id' => $course['id'],
            'name' => 'Module hérité',
            'order_index' => 1,
        ]);

        // Un ancien client peut encore envoyer module_id : il est ignoré,
        // une session couvre toute la formation, pas un module unique.
        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'module_id' => $module->id,
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->assertArrayNotHasKey('module', $session);
        $this->assertNull(
            \Illuminate\Support\Facades\DB::table('training_sessions')->where('id', $session['id'])->value('module_id')
        );
    }

    public function test_deleting_enrollment_cancels_linked_invoice(): void
    {
        $this->admin();
        $course = $this->createCourse(['price' => 50000]);
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201)
            ->json();

        $this->assertNotNull($enrollment['invoice_id']);
        $this->assertDatabaseHas('invoices', [
            'id' => $enrollment['invoice_id'],
            'cancelled_at' => null,
        ]);

        $this->deleteJson('/api/formation-enrollments/'.$enrollment['id'])->assertStatus(204);

        $this->assertDatabaseHas('invoices', [
            'id' => $enrollment['invoice_id'],
            'status' => 'cancelled',
        ]);
        $this->assertNotNull(Invoice::find($enrollment['invoice_id'])?->cancelled_at);
    }

    public function test_attendance_is_recorded_per_module(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $client = $this->createClient();

        $moduleA = \App\Models\CourseModule::create([
            'course_id' => $course['id'],
            'name' => 'Module A',
            'order_index' => 1,
        ]);
        $moduleB = \App\Models\CourseModule::create([
            'course_id' => $course['id'],
            'name' => 'Module B',
            'order_index' => 2,
        ]);

        $session = $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated()
            ->json();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'training_session_id' => $session['id'],
        ])->assertStatus(201);

        // Présence notée pour le module A uniquement.
        $this->putJson("/api/training-sessions/{$session['id']}/attendances", [
            'course_module_id' => $moduleA->id,
            'attendances' => [['learner_user_id' => $client->id, 'status' => 'present']],
        ])->assertOk()
            ->assertJsonPath('attendances.0.status', 'present');

        $this->assertDatabaseHas('attendances', [
            'training_session_id' => $session['id'],
            'learner_user_id' => $client->id,
            'course_module_id' => $moduleA->id,
            'status' => 'present',
        ]);

        // Le module B n'a pas encore été rempli pour cette session.
        $this->getJson("/api/training-sessions/{$session['id']}/attendances?course_module_id={$moduleB->id}")
            ->assertOk()
            ->assertJsonPath('attendances.0.status', null);

        // Sans module, aucune présence héritée n'est recréée.
        $this->getJson("/api/training-sessions/{$session['id']}/attendances")
            ->assertOk()
            ->assertJsonPath('attendances.0.status', null);
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

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
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

    public function test_learners_search_matches_full_name_across_terms(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');

        $rapBro = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
            'first_name' => 'rap',
            'last_name' => 'bro',
            'registered_agency_id' => $agency->id,
        ]);
        User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
            'first_name' => 'Autre',
            'last_name' => 'Personne',
            'registered_agency_id' => $agency->id,
        ]);

        $response = $this->getJson('/api/learners?agency_id='.$agency->id.'&search=rap+bro')
            ->assertOk();

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($rapBro->id), 'La recherche « rap bro » doit trouver le prénom + nom.');
        $this->assertCount(1, $ids);

        // Une seule partie du nom suffit aussi.
        $this->getJson('/api/learners?agency_id='.$agency->id.'&search=rap')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_enrollment_accepts_trainer_seller_without_account(): void
    {
        $admin = $this->admin();
        $course = $this->createCourse(['price' => 50000]);
        $client = $this->createClient();
        $trainer = Trainer::create([
            'first_name' => 'rap',
            'last_name' => 'poo',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_trainer_id' => $trainer->id,
        ])->assertStatus(201);

        $response->assertJsonPath('seller_trainer.first_name', 'rap')
            ->assertJsonPath('seller_trainer.last_name', 'poo')
            ->assertJsonPath('seller_user_id', null);

        // La facture auto ne lie pas un user, mais mentionne le formateur.
        $invoiceId = $response->json('invoice_id');
        $this->assertNotNull($invoiceId);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'seller_user_id' => null,
            'comment' => "Inscription à la formation Cours de comptabilité — Vendeur : rap poo",
        ]);

        // Un vendeur utilisateur et un formateur ne peuvent pas être envoyés ensemble.
        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $this->createClient()->id,
            'seller_user_id' => $admin->id,
            'seller_trainer_id' => $trainer->id,
        ])->assertStatus(422);
    }

    public function test_trainer_seller_commission_via_profile_and_balance_not_negative(): void
    {
        $this->admin();

        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 50000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $client = $this->createClient();

        $profile = SellerProfile::create([
            'user_id' => $trainer->user_id,
            'agency_id' => $agency->id,
            'kind' => SellerProfile::KIND_TRAINER,
            'commission_type' => 'percent',
            'commission_value' => 10,
            'is_active' => true,
        ]);

        // Inscription vendue par le formateur (identifié par seller_trainer_id).
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_trainer_id' => $trainer->id,
        ])->assertStatus(201)->json();

        $this->postJson("/api/invoices/{$enrollment['invoice_id']}/payments", [
            'amount' => 50000,
            'payment_method' => 'cash',
        ])->assertOk();

        // Le vendeur formateur touche sa commission via son profil vendeur.
        $this->assertDatabaseHas('commission_entries', [
            'invoice_id' => $enrollment['invoice_id'],
            'seller_profile_id' => $profile->id,
            'commission_rule_id' => null,
            'amount' => 5000.00,
            'status' => 'calculated',
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $enrollment['invoice_id'], 'commission_amount' => 5000]);

        // Solde affiché = entrées impayées.
        $data = $this->getJson('/api/commission-payments/summary?agency_id='.$agency->id)->assertOk()->json('data');
        $before = collect($data)->firstWhere('id', $profile->id);
        $this->assertNotNull($before, 'Le profil vendeur doit apparaître dans le résumé.');
        $this->assertEquals(5000, $before['total_owed']);
        $this->assertEquals(0, $before['total_paid']);
        $this->assertEquals(5000, $before['balance']);

        // Règlement de la commission : le solde passe à 0, jamais négatif.
        $account = TreasuryAccount::create([
            'agency_id' => $agency->id,
            'name' => 'Caisse Test',
            'type' => 'cash',
            'opening_balance' => 0,
            'currency_code' => 'XAF',
            'is_active' => true,
        ]);

        $this->postJson('/api/commission-payments', [
            'beneficiary_type' => 'seller_profile',
            'beneficiary_id' => $profile->id,
            'amount' => 5000,
            'treasury_account_id' => $account->id,
            'note' => 'Règlement test',
        ])->assertStatus(201);

        $data = $this->getJson('/api/commission-payments/summary?agency_id='.$agency->id)->assertOk()->json('data');
        $after = collect($data)->firstWhere('id', $profile->id);
        $this->assertEquals(0, $after['total_owed']);
        $this->assertEquals(5000, $after['total_paid']);
        // Régression : l'ancien calcul (entrées − versements) donnait -5000.00.
        $this->assertEquals(0, $after['balance']);
    }

    public function test_paying_commission_entry_records_treasury_outflow_and_accounting(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $trainer = $this->createTrainer();

        $profile = SellerProfile::create([
            'user_id' => $trainer->user_id,
            'agency_id' => $agency->id,
            'kind' => SellerProfile::KIND_TRAINER,
            'commission_type' => 'percent',
            'commission_value' => 10,
            'is_active' => true,
        ]);

        $account = TreasuryAccount::create([
            'agency_id' => $agency->id,
            'name' => 'Caisse Test',
            'type' => 'cash',
            'opening_balance' => 0,
            'currency_code' => 'XAF',
            'is_active' => true,
        ]);

        $entry = $this->postJson('/api/commissions/entries', [
            'seller_profile_id' => $profile->id,
            'category' => 'training',
            'amount' => 2000,
            'label' => 'Cours AV',
        ])->assertStatus(201)->json();

        $this->postJson('/api/commissions/entries/'.$entry['id'].'/pay')->assertOk();

        // L'entrée est payée.
        $this->assertDatabaseHas('commission_entries', ['id' => $entry['id'], 'status' => 'paid']);
        $this->assertDatabaseHas('commission_payments', [
            'commission_entry_id' => $entry['id'],
            'seller_profile_id' => $profile->id,
            'treasury_account_id' => $account->id,
            'rule' => 'commission_payment',
            'amount' => 2000.00,
        ]);

        $payment = \App\Models\CommissionPayment::where('commission_entry_id', $entry['id'])->firstOrFail();

        // Sortie de trésorerie enregistrée (source = paiement de commission).
        $this->assertDatabaseHas('treasury_transactions', [
            'treasury_account_id' => $account->id,
            'direction' => 'out',
            'amount' => 2000.00,
            'category' => 'commission',
            'source_type' => 'commission_payment',
            'source_id' => $payment->id,
        ]);

        // Écriture comptable (dépense) partageant la même référence que la sortie.
        $movement = \App\Models\TreasuryTransaction::where('source_type', 'commission_payment')
            ->where('source_id', $payment->id)
            ->firstOrFail();

        $this->assertDatabaseHas('accounting_transactions', [
            'agency_id' => $agency->id,
            'type' => 'expense',
            'amount' => 2000.00,
            'beneficiary' => $profile->full_name,
            'reference' => $movement->reference,
        ]);
    }

    public function test_invoice_sold_by_trainer_account_creates_employee_seller_profile_and_service_sales(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        // Aucun profil vendeur avant la première vente.
        $this->assertDatabaseCount('seller_profiles', 0);

        $invoice = $this->postJson('/api/invoices', [
            'agency_id' => $agency->id,
            'client_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
            'items' => [
                ['label' => 'Conseil en gestion', 'unit_price' => 10000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->assertSame($trainer->user_id, $invoice['seller_user_id']);

        // Profil vendeur auto-créé pour le formateur (employé, sans taux inventé).
        $this->assertDatabaseHas('seller_profiles', [
            'user_id' => $trainer->user_id,
            'agency_id' => $agency->id,
            'kind' => 'employee',
            'commission_type' => 'none',
            'commission_value' => 0,
            'is_active' => true,
        ]);

        // La fiche formateur ventile la vente côté « services ».
        $this->getJson('/api/trainers/'.$trainer->id.'/stats')
            ->assertOk()
            ->assertJsonPath('stats.service_sales.count', 1)
            ->assertJsonPath('stats.service_sales.turnover', 10000)
            ->assertJsonPath('stats.service_sales.paid_count', 0)
            ->assertJsonPath('stats.formation_sales.count', 0)
            ->assertJsonPath('recent_service_sales.0.number', $invoice['number']);
    }

    public function test_trainer_stats_split_training_and_service_sales_and_manual_commission_entries(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 50000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        // Vente de formation attribuée au formateur via son compte utilisateur.
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
        ])->assertStatus(201)->json();

        $this->assertSame($trainer->user_id, $enrollment['seller_user_id']);
        $this->assertDatabaseHas('seller_profiles', [
            'user_id' => $trainer->user_id,
            'kind' => 'employee',
            'commission_type' => 'none',
        ]);

        // Encaissement : aucune commission automatique (profil sans taux).
        $this->postJson("/api/invoices/{$enrollment['invoice_id']}/payments", [
            'amount' => 50000,
            'payment_method' => 'cash',
        ])->assertOk();

        $this->assertDatabaseMissing('commission_entries', ['invoice_id' => $enrollment['invoice_id']]);

        $profile = SellerProfile::where('user_id', $trainer->user_id)->firstOrFail();

        // Pilotage manuel : ajout + surcharge de montant, par catégorie.
        $trainingEntry = $this->postJson('/api/commissions/entries', [
            'seller_profile_id' => $profile->id,
            'category' => 'training',
            'amount' => 2000,
            'label' => 'Cours AV',
        ])->assertStatus(201)->json();

        $serviceEntry = $this->postJson('/api/commissions/entries', [
            'seller_profile_id' => $profile->id,
            'category' => 'service',
            'amount' => 1500,
            'label' => 'Conseil',
        ])->assertStatus(201)->json();

        $this->assertSame('validated', $trainingEntry['status']);

        $this->putJson('/api/commissions/entries/'.$trainingEntry['id'], [
            'amount' => 2500,
            'label' => 'Cours AV (réévalué)',
        ])->assertOk();

        // Une entrée payée ne se modifie plus.
        $this->postJson('/api/commissions/entries/'.$trainingEntry['id'].'/pay')->assertOk();

        $this->putJson('/api/commissions/entries/'.$trainingEntry['id'], ['amount' => 100])
            ->assertStatus(422);

        // Fiche formateur : 2 sections ventes + commissions par catégorie.
        $this->getJson('/api/trainers/'.$trainer->id.'/stats')
            ->assertOk()
            ->assertJsonPath('stats.formation_sales.count', 1)
            ->assertJsonPath('stats.formation_sales.turnover', 50000)
            ->assertJsonPath('stats.service_sales.count', 0)
            ->assertJsonPath('stats.commissions_training', 2500)
            ->assertJsonPath('stats.commissions_service', 1500)
            ->assertJsonPath('stats.commissions_earned', 4000)
            ->assertJsonPath('stats.commissions_paid', 2500)
            ->assertJsonPath('stats.commissions_balance', 1500)
            ->assertJsonPath('recent_formation_sales.0.amount', 50000);
    }

    public function test_trainer_earns_sales_points_when_invoice_is_paid(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 50000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        // Vente de formation attribuée au formateur via son compte utilisateur.
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
        ])->assertStatus(201)->json();

        $invoiceId = $enrollment['invoice_id'];

        // Règlement partiel : pas encore « sold out », aucun point attribué.
        $this->postJson("/api/invoices/{$invoiceId}/payments", [
            'amount' => 25000,
            'payment_method' => 'cash',
        ])->assertOk();

        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'points_awarded' => 0]);
        $this->assertDatabaseMissing('trainer_points', ['trainer_id' => $trainer->id]);

        // Règlement du solde : la facture est soldée, le formateur gagne les points de vente (3 par défaut).
        $this->postJson("/api/invoices/{$invoiceId}/payments", [
            'amount' => 25000,
            'payment_method' => 'cash',
        ])->assertOk();

        $this->assertDatabaseHas('trainer_points', [
            'trainer_id' => $trainer->id,
            'points' => 3,
            'reason' => 'sale',
            'invoice_id' => $invoiceId,
        ]);
        $this->assertDatabaseHas('trainers', ['id' => $trainer->id, 'points_balance' => 3]);
        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'points_awarded' => 3]);

        // Idempotence : une nouvelle tentative d'attribution ne duplique pas les points.
        app(PointsService::class)->awardForSale(Invoice::findOrFail($invoiceId));

        $this->assertDatabaseCount('trainer_points', 1);
        $this->assertDatabaseHas('trainers', ['id' => $trainer->id, 'points_balance' => 3]);
    }

    public function test_employees_list_shows_trainer_points_balance(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 50000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
        ])->assertStatus(201)->json();

        $this->postJson("/api/invoices/{$enrollment['invoice_id']}/payments", [
            'amount' => 50000,
            'payment_method' => 'cash',
        ])->assertOk();

        // Annuaire RH unifié : le formateur affiche ses points gagnés.
        $this->getJson('/api/employees?agency_id='.$agency->id.'&include_trainers=1&per_page=100')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $trainer->id,
                'is_trainer' => true,
                'points_balance' => 3,
            ]);
    }

    public function test_employees_ranking_includes_trainers_with_points_and_sales(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 50000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        // Employé (commercial kind=employe) sans ventes ni points.
        $this->postJson('/api/commercials', [
            'first_name' => 'Employé',
            'last_name' => 'Test',
            'email' => fake()->unique()->safeEmail(),
            'kind' => 'employe',
            'commission_type' => 'none',
            'commission_value' => 0,
        ])->assertStatus(201);

        // Vente de formation attribuée au formateur, soldée → 3 points + 1 vente.
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
        ])->assertStatus(201)->json();

        $this->postJson("/api/invoices/{$enrollment['invoice_id']}/payments", [
            'amount' => 50000,
            'payment_method' => 'cash',
        ])->assertOk();

        $ranking = $this->getJson('/api/employees/ranking?limit=50')->assertOk()->json();

        $trainerRow = collect($ranking)->firstWhere('id', $trainer->id);
        $this->assertNotNull($trainerRow, 'Le formateur doit apparaître dans le classement employés.');
        $this->assertEquals(3, $trainerRow['points_balance']);
        $this->assertEquals(1, $trainerRow['sales_count']);
        $this->assertEquals(50000, $trainerRow['turnover']);
        $this->assertTrue($trainerRow['is_trainer']);

        // Le formateur (3 points) domine le classement au détriment des employés à 0.
        $this->assertEquals($trainer->id, $ranking[0]['id']);
    }

    public function test_trainer_stats_handle_collection_status_filtering(): void
    {
        $this->admin();
        $course = $this->createCourse(['price' => 50000]);
        $trainer = $this->createTrainer();

        $this->postJson('/api/training-sessions', [
            'course_id' => $course['id'],
            'trainer_id' => $trainer->id,
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertCreated();

        $client = $this->createClient();
        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
        ])->assertStatus(201);

        // Régression : stats() appliquait ->whereNot() sur une Collection.
        $this->getJson('/api/trainers/'.$trainer->id.'/stats')
            ->assertOk()
            ->assertJsonPath('stats.sessions_total', 1)
            ->assertJsonPath('stats.enrollments_enrolled', 1)
            ->assertJsonPath('stats.potential_revenue', 50000);
    }

    public function test_training_group_mode_breakdown_counts_catalog_courses(): void
    {
        $this->admin();

        // La répartition par mode se compte sur le catalogue de formations actives,
        // indépendamment des sessions et des inscriptions.
        $this->createCourse(['mode' => 'online']);
        $this->createCourse(['mode' => 'online']);
        $this->createCourse(['mode' => 'in_person']);

        $this->getJson('/api/stats/training-group')
            ->assertOk()
            ->assertJsonPath('training.mode_breakdown.0.mode', 'in_person')
            ->assertJsonPath('training.mode_breakdown.0.value', 1)
            ->assertJsonPath('training.mode_breakdown.1.mode', 'online')
            ->assertJsonPath('training.mode_breakdown.1.value', 2)
            ->assertJsonPath('training.mode_breakdown.2.mode', 'mixed')
            ->assertJsonPath('training.mode_breakdown.2.value', 0);
    }

    public function test_courses_index_filters_by_mode(): void
    {
        $this->admin();
        $this->createCourse(['name' => 'Formation en ligne', 'mode' => 'online']);
        $this->createCourse(['name' => 'Formation présentiel', 'mode' => 'in_person']);

        $this->getJson('/api/courses?mode=online')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Formation en ligne');
    }

    public function test_courses_index_filters_by_category(): void
    {
        $this->admin();
        $category = CourseCategory::create(['name' => 'Finance']);
        $course = $this->createCourse(['name' => 'Comptabilité']);
        Course::find($course['id'])->categories()->sync([$category->id]);

        $this->getJson('/api/courses?categories[]='.$category->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Comptabilité');
    }

    public function test_courses_index_filters_by_promotion_status(): void
    {
        $this->admin();
        $withActive = $this->createCourse(['name' => 'Promo active']);
        $withExpired = $this->createCourse(['name' => 'Promo expirée']);
        $without = $this->createCourse(['name' => 'Sans promo']);

        Promotion::create([
            'formation_id' => $withActive['id'],
            'type' => 'amount',
            'promo_price' => 30000,
            'start_date' => now()->subDay(),
            'end_date' => now()->addDays(5),
        ]);

        Promotion::create([
            'formation_id' => $withExpired['id'],
            'type' => 'amount',
            'promo_price' => 30000,
            'start_date' => now()->subDays(10),
            'end_date' => now()->subDay(),
        ]);

        $this->getJson('/api/courses?promotion=active')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Promo active');

        $this->getJson('/api/courses?promotion=none')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Promo expirée')
            ->assertJsonPath('data.1.name', 'Sans promo');
    }

    public function test_trainer_stats_reflect_collected_revenue_on_partial_payments(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 7000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
        ])->assertStatus(201)->json();

        // Encaissement partiel : 4000 sur 7000.
        $this->postJson("/api/invoices/{$enrollment['invoice_id']}/payments", [
            'amount' => 4000,
            'payment_method' => 'cash',
        ])->assertOk();

        // Le CA encaissé reflète la somme des versements, pas les seules factures payées.
        $this->getJson('/api/trainers/'.$trainer->id.'/stats')
            ->assertOk()
            ->assertJsonPath('stats.formation_sales.count', 1)
            ->assertJsonPath('stats.formation_sales.turnover', 7000)
            ->assertJsonPath('stats.formation_sales.paid_count', 1)
            ->assertJsonPath('stats.formation_sales.paid_turnover', 4000);
    }

    public function test_recalculate_seller_profile_commissions_is_idempotent_per_payment(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->createCourse(['price' => 10000, 'agency_id' => $agency->id]);
        $trainer = $this->createTrainer();
        $trainer->update(['agency_id' => $agency->id]);
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $client->id,
            'seller_user_id' => $trainer->user_id,
        ])->assertStatus(201)->json();

        // Encaissement intégral : aucun profil avec taux → aucune commission automatique.
        $this->postJson("/api/invoices/{$enrollment['invoice_id']}/payments", [
            'amount' => 10000,
            'payment_method' => 'cash',
        ])->assertOk();

        $profile = SellerProfile::where('user_id', $trainer->user_id)->firstOrFail();
        $this->assertDatabaseMissing('commission_entries', ['invoice_id' => $enrollment['invoice_id']]);

        // Le responsable fixe un taux de 10 % depuis la fiche (l'envoi réinitialise tous les champs).
        $this->putJson('/api/seller-profiles/'.$profile->id, [
            'commission_type' => 'percent',
            'commission_value' => 10,
        ])->assertOk();

        // Le versement existant n'a pas encore de commission tant que l'on ne recalcule pas.
        $this->getJson('/api/trainers/'.$trainer->id.'/stats')
            ->assertJsonPath('stats.commissions_training', 0);

        // Recalcul : le versement déjà encaissé est commissionné.
        $this->postJson('/api/commissions/seller-profiles/'.$profile->id.'/recalculate')
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.payments', 1);

        $this->assertDatabaseHas('commission_entries', [
            'invoice_id' => $enrollment['invoice_id'],
            'seller_profile_id' => $profile->id,
            'status' => 'calculated',
        ]);

        $this->getJson('/api/trainers/'.$trainer->id.'/stats')
            ->assertJsonPath('stats.commissions_training', 1000);

        // Idempotence : un second recalcul ne recrée aucune entrée (même versement).
        $this->postJson('/api/commissions/seller-profiles/'.$profile->id.'/recalculate')
            ->assertOk()
            ->assertJsonPath('data.created', 0);

        $this->assertDatabaseCount('commission_entries', 1);
    }
}