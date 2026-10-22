<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrainerAssignmentTest extends TestCase
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

    private function userWithRole(string $roleName, ?Agency $agency = null, ?string $firstName = null): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
            'first_name' => $firstName ?? ucfirst(str_replace('-', ' ', $roleName)),
            'last_name' => $roleName,
        ]);

        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                // Une seule affectation principale par agence (index unique).
                'is_primary' => false,
            ]);
        }

        return $user;
    }

    private function course(Agency $agency): Course
    {
        return Course::create([
            'name' => 'Formation Leadership',
            'code' => Course::generateCode(),
            'mode' => 'in_person',
            'agency_id' => $agency->id,
            'price' => 25000,
            'duration_hours' => 12,
            'is_active' => true,
        ]);
    }

    public function test_candidates_expose_employees_of_every_internal_role(): void
    {
        $this->admin();

        $commercial = $this->userWithRole('commercial');
        $caissier = $this->userWithRole('caissier');

        $response = $this->getJson('/api/trainers/candidates')->assertOk();

        $emails = collect($response->json('data'))->pluck('email');

        $this->assertTrue($emails->contains($commercial->email), 'Un commercial doit être proposé.');
        $this->assertTrue($emails->contains($caissier->email), 'Un caissier doit être proposé.');

        $commercialCandidate = collect($response->json('data'))
            ->firstWhere('user_id', $commercial->id);

        $this->assertSame('commercial', $commercialCandidate['role']);
        $this->assertSame('user', $commercialCandidate['kind']);
    }

    public function test_candidates_exclude_client_accounts(): void
    {
        $this->admin();

        $client = $this->userWithRole('client');

        $response = $this->getJson('/api/trainers/candidates')->assertOk();

        $this->assertFalse(
            collect($response->json('data'))->contains('user_id', $client->id),
            'Un compte client ne doit pas être proposé comme formateur.'
        );
    }

    public function test_candidates_can_be_filtered_by_role(): void
    {
        $this->admin();

        $commercial = $this->userWithRole('commercial');
        $caissier = $this->userWithRole('caissier');

        $response = $this->getJson('/api/trainers/candidates?role=caissier')->assertOk();

        $userIds = collect($response->json('data'))->pluck('user_id');

        $this->assertTrue($userIds->contains($caissier->id));
        $this->assertFalse($userIds->contains($commercial->id));
    }

    public function test_candidates_can_be_searched_by_name(): void
    {
        $this->admin();

        $commercial = $this->userWithRole('commercial', null, 'Awa');
        $this->userWithRole('caissier');

        $response = $this->getJson('/api/trainers/candidates?search=awa')->assertOk();

        $userIds = collect($response->json('data'))->pluck('user_id');

        $this->assertTrue($userIds->contains($commercial->id));
        $this->assertCount(1, $userIds);
    }

    public function test_candidates_keep_external_trainer_profiles_without_account(): void
    {
        $this->admin();

        $agency = Agency::first();
        $trainer = Trainer::create([
            'agency_id' => $agency?->id,
            'first_name' => 'Intervenant',
            'last_name' => 'Externe',
            'email' => 'intervenant.externe@example.com',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/trainers/candidates')->assertOk();

        $candidate = collect($response->json('data'))
            ->firstWhere('trainer_id', $trainer->id);

        $this->assertNotNull($candidate, 'Un profil formateur sans compte doit rester assignable.');
        $this->assertSame('profile', $candidate['kind']);
        $this->assertNull($candidate['user_id']);
    }

    public function test_session_accepts_an_employee_who_is_not_a_trainer(): void
    {
        $this->admin();

        $agency = Agency::first();
        $course = $this->course($agency);
        $commercial = $this->userWithRole('commercial', $agency);

        $response = $this->postJson('/api/training-sessions', [
            'course_id' => $course->id,
            'agency_id' => $agency?->id,
            'start_at' => now()->addDays(3)->toISOString(),
            'trainer_user_id' => $commercial->id,
        ])->assertStatus(201);

        $trainerId = $response->json('trainer.id');

        $this->assertNotNull($trainerId, 'La session doit référencer un profil formateur.');

        // Un profil formateur est créé pour le compte, il est réutilisé ensuite.
        $trainer = Trainer::where('user_id', $commercial->id)->first();
        $this->assertNotNull($trainer);
        $this->assertSame($trainer->id, $trainerId);
        $this->assertSame('Commercial', $trainer->first_name);

        $this->assertSame($commercial->id, $response->json('trainer.user_id'));
    }

    public function test_session_rejects_a_client_account_as_trainer(): void
    {
        $this->admin();

        $agency = Agency::first();
        $course = $this->course($agency);
        $client = $this->userWithRole('client', $agency);

        $this->postJson('/api/training-sessions', [
            'course_id' => $course->id,
            'agency_id' => $agency?->id,
            'start_at' => now()->addDays(3)->toISOString(),
            'trainer_user_id' => $client->id,
        ])->assertStatus(422)->assertJsonValidationErrors('trainer_user_id');
    }

    public function test_session_rejects_an_inactive_employee_as_trainer(): void
    {
        $this->admin();

        $agency = Agency::first();
        $course = $this->course($agency);
        $commercial = $this->userWithRole('commercial', $agency);
        $commercial->update(['is_active' => false]);

        $this->postJson('/api/training-sessions', [
            'course_id' => $course->id,
            'agency_id' => $agency?->id,
            'start_at' => now()->addDays(3)->toISOString(),
            'trainer_user_id' => $commercial->id,
        ])->assertStatus(422)->assertJsonValidationErrors('trainer_user_id');
    }

    public function test_updating_a_session_can_change_the_trainer_for_any_employee(): void
    {
        $this->admin();

        $agency = Agency::first();
        $course = $this->course($agency);
        $commercial = $this->userWithRole('commercial', $agency);

        $created = $this->postJson('/api/training-sessions', [
            'course_id' => $course->id,
            'agency_id' => $agency?->id,
            'start_at' => now()->addDays(3)->toISOString(),
        ])->assertStatus(201);

        $this->assertNull($created->json('trainer.id'));

        $updated = $this->putJson("/api/training-sessions/{$created->json('id')}", [
            'trainer_user_id' => $commercial->id,
        ])->assertOk();

        $this->assertSame(
            Trainer::where('user_id', $commercial->id)->value('id'),
            $updated->json('trainer.id')
        );
    }
}
