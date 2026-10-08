<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Department;
use App\Models\Prestation;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * N1-N6 (D23) : note globale directe du client sur la prestation.
 * Prioritaire sur la moyenne des notes d'actions pour l'affichage
 * (`display_rating_avg` / `display_rating_count`).
 *
 * Authentification par token réel : `portal:client` refuse les tokens
 * transients de `Sanctum::actingAs` (nom de token absent).
 */
class PrestationDirectRatingTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
        $this->department = Department::factory()->create([
            'agency_id' => $this->agency->id,
            'type' => Department::TYPE_AGENCY,
        ]);
    }

    private function userWithRole(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    /**
     * Changer de profil au sein d'un même test : le garde sanctum met en
     * cache l'utilisateur résolu, il faut donc oublier les gardes à chaque
     * nouveau token.
     */
    private function actAs(User $user, string $token = 'staff-token'): void
    {
        $this->withToken($user->createToken($token)->plainTextToken);
        $this->app['auth']->forgetGuards();
    }

    private function createPrestation(User $client): array
    {
        $this->actAs($this->userWithRole('super-admin'));

        return $this->postJson('/api/prestations', [
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Campagne rentrée',
            'client_id' => $client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => 500000,
        ])->assertStatus(201)->json();
    }

    /** Passe la prestation en `in_progress` (statut noté : D12). */
    private function makeRateable(User $client): Prestation
    {
        $prestation = $this->createPrestation($client);
        $id = $prestation['id'];

        $this->postJson("/api/prestations/{$id}/submit")->assertOk();
        $this->postJson("/api/prestations/{$id}/validate")->assertOk();
        $this->postJson("/api/prestations/{$id}/start")->assertOk();

        return Prestation::findOrFail($id);
    }

    public function test_client_rates_prestation_and_display_rating_overrides_action_average(): void
    {
        $client = $this->userWithRole('client');
        $prestation = $this->makeRateable($client);

        $this->actAs($this->userWithRole('super-admin'));
        $action = $this->postJson("/api/prestations/{$prestation->id}/actions", ['title' => 'Instagram'])
            ->assertStatus(201)->json();

        $this->actAs($client, 'client-token');
        $this->putJson("/api/client/prestation-actions/{$action['id']}/review", [
            'rating' => 5,
            'comment' => 'Impeccable',
        ])->assertOk();

        $prestation->refresh();
        $this->assertEquals(5.0, (float) $prestation->rating_avg);
        $this->assertSame(1, $prestation->rating_count);

        $response = $this->putJson("/api/client/prestations/{$prestation->id}/review", [
            'rating' => 3,
            'comment' => 'Correct mais en retard',
        ])->assertOk()->json();

        $this->assertEquals(3, $response['display_rating']['avg']);
        $this->assertSame(1, $response['display_rating']['count']);
        $this->assertTrue($response['rating_summary']['has_direct_rating']);
        $this->assertEquals(3, $response['rating_summary']['direct_rating']);
        $this->assertEquals(5.0, (float) $response['rating_summary']['avg'], 'la moyenne des actions reste inchangée');

        $prestation->refresh();
        $this->assertSame(3, $prestation->client_direct_rating);
        $this->assertSame('Correct mais en retard', $prestation->client_direct_comment);
        $this->assertSame($client->id, $prestation->client_direct_rated_by);
        $this->assertNotNull($prestation->client_direct_rated_at);
        $this->assertEquals(3, $prestation->display_rating_avg);
        $this->assertSame(1, $prestation->display_rating_count);
    }

    public function test_updating_direct_rating_replaces_previous_one(): void
    {
        $client = $this->userWithRole('client');
        $prestation = $this->makeRateable($client);

        $this->actAs($client, 'client-token');
        $this->putJson("/api/client/prestations/{$prestation->id}/review", ['rating' => 4])->assertOk();

        $this->putJson("/api/client/prestations/{$prestation->id}/review", ['rating' => 2, 'comment' => 'Mauvais'])
            ->assertOk();

        $prestation->refresh();
        $this->assertSame(2, $prestation->client_direct_rating);
        $this->assertSame(1, $prestation->display_rating_count, 'une seule note directe : elle est remplacée, pas cumulée');
    }

    public function test_client_cannot_rate_another_clients_prestation(): void
    {
        $owner = $this->userWithRole('client');
        $prestation = $this->makeRateable($owner);

        $this->actAs($this->userWithRole('client'), 'client-token');
        $this->putJson("/api/client/prestations/{$prestation->id}/review", ['rating' => 1])
            ->assertStatus(404);
    }

    public function test_client_cannot_rate_a_prestation_not_yet_started(): void
    {
        $client = $this->userWithRole('client');
        $prestation = $this->createPrestation($client);

        $this->actAs($this->userWithRole('super-admin'));
        $this->postJson("/api/prestations/{$prestation['id']}/submit")->assertOk();
        $this->postJson("/api/prestations/{$prestation['id']}/validate")->assertOk();

        $this->actAs($client, 'client-token');
        $this->putJson("/api/client/prestations/{$prestation['id']}/review", ['rating' => 5])
            ->assertStatus(422);
    }

    public function test_staff_tracking_exposes_display_rating_and_direct_flag(): void
    {
        $client = $this->userWithRole('client');
        $prestation = $this->makeRateable($client);

        $this->actAs($client, 'client-token');
        $this->putJson("/api/client/prestations/{$prestation->id}/review", ['rating' => 2])->assertOk();

        $this->actAs($this->userWithRole('super-admin'));
        $row = $this->getJson('/api/prestations/tracking')->assertOk()->json('data')[0];

        $this->assertSame($prestation->id, $row['id']);
        $this->assertEquals(2, $row['display_rating_avg']);
        $this->assertSame(1, $row['display_rating_count']);
        $this->assertTrue($row['has_direct_rating']);
        $this->assertNull($row['rating_avg'], 'la moyenne des actions reste nulle');
    }
}
