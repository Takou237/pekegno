<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\City;
use App\Models\Course;
use App\Models\Country;
use App\Models\Role;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrainingSessionAgencyTest extends TestCase
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

    private function agencyIn(string $countryCode): Agency
    {
        $country = Country::where('code', $countryCode)->firstOrFail();
        $city = City::whereIn('country_id', [$country->id])->firstOrFail();

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

    private function sessionsInAgency(string $agencyId): array
    {
        return $this->getJson("/api/training-sessions?agency_id={$agencyId}")
            ->assertOk()
            ->json('data');
    }

    /** Même formation (même nom) déployée dans deux agences de pays différents. */
    private function courseDeployedIn(Agency $agencyA, Agency $agencyB, string $name): array
    {
        $courseA = $this->postJson('/api/courses', [
            'name' => $name,
            'mode' => 'in_person',
            'agency_id' => $agencyA->id,
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201)->json();

        $this->postJson('/api/courses', [
            'name' => $name,
            'mode' => 'in_person',
            'agency_id' => $agencyB->id,
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201);

        return $courseA;
    }

    public function test_session_is_created_only_in_its_own_agency(): void
    {
        $this->admin();
        $agencyA = $this->agencyIn('CMR');
        $agencyB = $this->agencyIn('CIV');
        $courseA = $this->courseDeployedIn($agencyA, $agencyB, 'Formation Excel');

        $this->postJson('/api/training-sessions', [
            'course_id' => $courseA['id'],
            'agency_id' => $agencyA->id,
            'start_at' => now()->addDays(7)->format('Y-m-d\TH:i'),
            'max_capacity' => 10,
        ])->assertStatus(201);

        // Une seule session, dans l'agence A, rien dans l'agence B.
        $this->assertSame(1, TrainingSession::count());
        $this->assertCount(1, $this->sessionsInAgency($agencyA->id));
        $this->assertCount(0, $this->sessionsInAgency($agencyB->id));
    }

    public function test_session_agency_follows_its_course_agency(): void
    {
        $this->admin();
        $agencyA = $this->agencyIn('CMR');
        $agencyB = $this->agencyIn('CIV');
        $courseA = $this->courseDeployedIn($agencyA, $agencyB, 'Formation Compta');

        // Agence incohérente envoyée : la session reste dans l'agence de la formation.
        $created = $this->postJson('/api/training-sessions', [
            'course_id' => $courseA['id'],
            'agency_id' => $agencyB->id,
            'start_at' => now()->addDays(7)->toISOString(),
        ])->assertStatus(201);

        $session = TrainingSession::findOrFail($created->json('id'));
        $this->assertSame($agencyA->id, $session->agency_id);

        $this->putJson("/api/training-sessions/{$session->id}", [
            'agency_id' => $agencyB->id,
        ])->assertOk();

        $this->assertSame($agencyA->id, $session->fresh()->agency_id);
    }

    public function test_several_sessions_of_same_course_can_be_created_in_same_agency(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');

        $course = $this->postJson('/api/courses', [
            'name' => 'Formation Word',
            'mode' => 'in_person',
            'agency_id' => $agency->id,
            'price' => 45000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201)->json();

        // Création libre : même formation, même agence, mêmes dates.
        $payload = [
            'course_id' => $course['id'],
            'agency_id' => $agency->id,
            'start_at' => now()->addDays(3)->toISOString(),
            'end_at' => now()->addDays(7)->toISOString(),
        ];
        $this->postJson('/api/training-sessions', $payload)->assertStatus(201);
        $this->postJson('/api/training-sessions', $payload)->assertStatus(201);

        $this->assertCount(2, $this->sessionsInAgency($agency->id));
    }

    public function test_update_does_not_touch_other_agencies(): void
    {
        $this->admin();
        $agencyA = $this->agencyIn('CMR');
        $agencyB = $this->agencyIn('CIV');
        $courseA = $this->courseDeployedIn($agencyA, $agencyB, 'Formation Sécurité');
        $courseB = Course::where('agency_id', $agencyB->id)->firstOrFail();

        $sessionA = $this->postJson('/api/training-sessions', [
            'course_id' => $courseA['id'],
            'agency_id' => $agencyA->id,
            'start_at' => now()->addDays(7)->toISOString(),
            'max_capacity' => 10,
        ])->assertStatus(201);

        $sessionB = $this->postJson('/api/training-sessions', [
            'course_id' => $courseB->id,
            'agency_id' => $agencyB->id,
            'start_at' => now()->addDays(7)->toISOString(),
            'max_capacity' => 10,
        ])->assertStatus(201);

        $this->putJson("/api/training-sessions/{$sessionA->json('id')}", [
            'start_at' => now()->addDays(14)->toISOString(),
            'max_capacity' => 25,
            'status' => 'ongoing',
        ])->assertOk();

        $other = TrainingSession::findOrFail($sessionB->json('id'));
        $this->assertSame(10, $other->max_capacity);
        $this->assertSame('planned', $other->status);
        $this->assertSame(2, TrainingSession::count());
    }

    /** Les chefs d'agence et de département suppriment une session (corbeille puis définitif). */
    public function test_agency_and_department_chiefs_can_delete_sessions(): void
    {
        $this->admin();
        $agency = $this->agencyIn('CMR');
        $course = $this->postJson('/api/courses', [
            'name' => 'Formation PowerPoint',
            'mode' => 'in_person',
            'agency_id' => $agency->id,
            'price' => 30000,
            'duration_hours' => 10,
            'is_active' => true,
        ])->assertStatus(201)->json();

        foreach (['responsable-agence', 'responsable-departement'] as $role) {
            $this->admin();
            $sessionId = $this->postJson('/api/training-sessions', [
                'course_id' => $course['id'],
                'start_at' => now()->addDays(5)->toISOString(),
            ])->assertStatus(201)->json('id');

            $chief = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
            if ($role === 'responsable-agence') {
                $chief->assignments()->sync([$agency->id => ['is_primary' => true]]);
            }
            Sanctum::actingAs($chief);

            $this->deleteJson("/api/training-sessions/{$sessionId}")->assertNoContent();
            $this->assertSoftDeleted('training_sessions', ['id' => $sessionId]);

            $this->deleteJson("/api/training-sessions/{$sessionId}/force-delete")->assertNoContent();
            $this->assertDatabaseMissing('training_sessions', ['id' => $sessionId]);
        }
    }
}
