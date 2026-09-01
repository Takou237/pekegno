<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase10AcademyGroupTest extends TestCase
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
        $country = \App\Models\Country::where('code', $countryCode)->firstOrFail();
        $city = \App\Models\City::whereIn('country_id', [$country->id])->firstOrFail();

        return Agency::create([
            'code' => Agency::generateNextCode(),
            'name' => "Académie {$country->code}",
            'type' => 'agency',
            'organization_id' => $country->organization_id,
            'country_id' => $country->id,
            'city_id' => $city->id,
            'country' => $country->name,
            'city' => $city->name,
        ]);
    }

    private function createClient(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
    }

    private function createCourse(array $overrides = []): array
    {
        return $this->postJson('/api/courses', array_merge([
            'name' => 'Formation Académie',
            'mode' => 'in_person',
            'price' => 40000,
            'duration_hours' => 16,
            'is_active' => true,
        ], $overrides))
            ->assertStatus(201)
            ->json();
    }

    public function test_training_agency_returns_per_agency_stats(): void
    {
        $this->admin();
        $cmr = $this->agencyIn('CMR');

        // Académie : 1 cours + inscription (facture impayée de 40000).
        $course = $this->createCourse(['name' => 'Formation CMR', 'agency_id' => $cmr->id]);
        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $this->createClient()->id,
        ])->assertStatus(201);

        $response = $this->getJson('/api/stats/training-agency?agency_id='.$cmr->id)
            ->assertOk();

        $academies = collect($response->json('academies.agencies'));
        $this->assertCount(1, $academies);

        $row = $academies->first();
        $this->assertEquals($cmr->id, $row['id']);
        $this->assertEquals(1, $row['courses']);
        $this->assertEquals(1, $row['learners']);
        $this->assertEquals(40000, $row['outstanding']);
        $this->assertEquals(0, $row['received']);
    }

    public function test_training_agency_ranking_orders_by_received_then_outstanding(): void
    {
        $this->admin();
        $quiet = $this->agencyIn('CMR');
        $active = $this->agencyIn('CIV');

        $course = $this->createCourse(['name' => 'Formation Active', 'agency_id' => $active->id]);
        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course['id'],
            'learner_user_id' => $this->createClient()->id,
        ])->assertStatus(201);

        $response = $this->getJson('/api/stats/training-agency')
            ->assertOk();

        $ranking = collect($response->json('academies.ranking'));

        // L'académie avec une inscription doit être présente et figurer plus haut
        // que celle, inactive, qui n'a aucune activité.
        $activeIdx = $ranking->search(fn ($r) => $r['id'] === $active->id);
        $quietIdx = $ranking->search(fn ($r) => $r['id'] === $quiet->id);
        $this->assertNotFalse($activeIdx);
        $this->assertNotFalse($quietIdx);
        $this->assertLessThan($quietIdx, $activeIdx);
    }

    public function test_training_agency_filters_by_country(): void
    {
        $this->admin();
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $response = $this->getJson('/api/stats/training-agency?country_id='.$cmr->country_id)
            ->assertOk();

        $ids = collect($response->json('academies.agencies'))->pluck('id');
        $this->assertTrue($ids->contains($cmr->id));
        $this->assertFalse($ids->contains($civ->id));
        $this->assertTrue($ids->every(fn ($id) => $id !== $civ->id));
    }

    public function test_training_agency_filters_by_specific_agency(): void
    {
        $this->admin();
        $cmr = $this->agencyIn('CMR');
        $civ = $this->agencyIn('CIV');

        $response = $this->getJson('/api/stats/training-agency?agency_id='.$cmr->id)
            ->assertOk();

        $agencies = $response->json('academies.agencies');
        $this->assertCount(1, $agencies);
        $this->assertEquals($cmr->id, $agencies[0]['id']);
        $this->assertNotEquals($civ->id, $agencies[0]['id']);
    }
}
