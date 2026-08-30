<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\TrainingSession;
use App\Models\Trainer;
use App\Models\TreasuryAccount;
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

    public function test_training_group_mode_breakdown_counts_enrollments_not_sessions(): void
    {
        $this->admin();
        $course = $this->createCourse(['mode' => 'online']);

        // 2 sessions pour la même formation…
        TrainingSession::factory()->create(['course_id' => $course['id'], 'status' => 'completed']);
        TrainingSession::factory()->create(['course_id' => $course['id'], 'status' => 'completed']);

        // …mais 3 inscriptions : la répartition par mode se compte sur les formations.
        foreach ([$this->createClient(), $this->createClient(), $this->createClient()] as $client) {
            $this->postJson('/api/formation-enrollments', [
                'course_id' => $course['id'],
                'learner_user_id' => $client->id,
            ])->assertStatus(201);
        }

        $this->getJson('/api/stats/training-group')
            ->assertOk()
            ->assertJsonPath('training.mode_breakdown.0.mode', 'in_person')
            ->assertJsonPath('training.mode_breakdown.0.value', 0)
            ->assertJsonPath('training.mode_breakdown.1.mode', 'online')
            ->assertJsonPath('training.mode_breakdown.1.value', 3)
            ->assertJsonPath('training.mode_breakdown.2.mode', 'mixed')
            ->assertJsonPath('training.mode_breakdown.2.value', 0);
    }
}