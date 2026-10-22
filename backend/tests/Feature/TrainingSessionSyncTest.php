<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Role;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrainingSessionSyncTest extends TestCase
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

    public function test_creation_with_sync_copies_session_to_sibling_agencies(): void
    {
        $this->admin();
        $agencyA = $this->agencyIn('CMR');
        $agencyB = $this->agencyIn('CIV');

        // Le même cours porte le même nom dans les deux agences.
        $courseA = $this->postJson('/api/courses', [
            'name' => 'Formation Excel',
            'mode' => 'in_person',
            'agency_id' => $agencyA->id,
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201)->json();

        $this->postJson('/api/courses', [
            'name' => 'formation excel', // sans casse : le matching est insensible à la casse
            'mode' => 'in_person',
            'agency_id' => $agencyB->id,
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201);

        $this->postJson('/api/training-sessions', [
            'course_id' => $courseA['id'],
            'agency_id' => $agencyA->id,
            'start_at' => now()->addDays(7)->toISOString(),
            'max_capacity' => 10,
            'sync_across_agencies' => true,
        ])->assertStatus(201);

        $sessionsB = $this->sessionsInAgency($agencyB->id);

        $this->assertCount(1, $sessionsB);
        $this->assertEquals(10, $sessionsB[0]['max_capacity']);
    }

    public function test_update_with_sync_propagates_changes_to_sibling_agencies(): void
    {
        $this->admin();
        $agencyA = $this->agencyIn('CMR');
        $agencyB = $this->agencyIn('CIV');

        $courseA = $this->postJson('/api/courses', [
            'name' => 'Formation Sécurité',
            'mode' => 'in_person',
            'agency_id' => $agencyA->id,
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201)->json();

        $this->postJson('/api/courses', [
            'name' => 'Formation Sécurité',
            'mode' => 'in_person',
            'agency_id' => $agencyB->id,
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ])->assertStatus(201);

        $created = $this->postJson('/api/training-sessions', [
            'course_id' => $courseA['id'],
            'agency_id' => $agencyA->id,
            'start_at' => now()->addDays(7)->toISOString(),
            'max_capacity' => 10,
            'status' => 'planned',
            'sync_across_agencies' => true,
        ])->assertStatus(201);

        $newStart = now()->addDays(14)->toISOString();

        // Modification dans l'agence A avec synchronisation demandée :
        // les valeurs doivent être répercutées dans l'agence B.
        $this->putJson("/api/training-sessions/{$created->json('id')}", [
            'start_at' => $newStart,
            'max_capacity' => 25,
            'status' => 'ongoing',
            'sync_across_agencies' => true,
        ])->assertOk();

        $other = TrainingSession::where('course_id', $courseA['id'])
            ->where('agency_id', $agencyB->id)
            ->whereNull('deleted_at')
            ->first();

        $this->assertNotNull($other, 'La session synchronisée doit exister dans l\'autre agence.');
        $this->assertEquals(25, $other->max_capacity);
        $this->assertEquals('ongoing', $other->status);
        $this->assertSame(
            date('Y-m-d H:i', strtotime($newStart)),
            $other->start_at->format('Y-m-d H:i'),
            'La date modifiée doit être répercutée dans l\'autre agence.'
        );
    }
}
