<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AgencyCategory;
use App\Models\Department;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Offres de prestation (3 niveaux : offre → souscriptions → détail) :
 * - CRUD de l'offre (nom + catégorie) ;
 * - chaque souscription hérite du département/catégorie de l'offre ;
 * - les listes filtrées par offer_id n'incluent jamais les prestations
 *   générées par la souscription d'un pack (offer_id null).
 */
class PrestationOfferTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private Department $department;

    private PrestationOffer $offer;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
        $this->department = Department::factory()->create([
            'agency_id' => $this->agency->id,
            'type' => Department::TYPE_AGENCY,
        ]);
        $this->offer = PrestationOffer::create([
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Campagne Facebook',
        ]);
        $this->client = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private function actingAsRole(string $role, ?Agency $agency = null): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);

        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                'department_id' => null,
                'is_primary' => false,
                'is_department_chief' => false,
            ]);
        }

        Sanctum::actingAs($user);

        return $user;
    }

    private function subscribe(array $overrides = []): array
    {
        return $this->postJson('/api/prestations', array_merge([
            'agency_id' => $this->agency->id,
            'offer_id' => $this->offer->id,
            'name' => 'Souscription',
            'client_id' => $this->client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => 250000,
        ], $overrides))->assertCreated()->json();
    }

    // ─── Offre : CRUD ────────────────────────────────────────────────────

    public function test_offer_can_be_created_listed_updated_and_deleted(): void
    {
        $this->actingAsRole('super-admin');

        $offer = $this->postJson('/api/prestation-offers', [
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Campagne LinkedIn',
            'description' => 'Gestion de la page LinkedIn',
            'is_active' => true,
        ])->assertCreated()->json();

        $this->getJson('/api/prestation-offers')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Campagne LinkedIn']);

        $this->putJson("/api/prestation-offers/{$offer['id']}", ['name' => 'Campagne LinkedIn Pro'])
            ->assertOk()
            ->assertJsonPath('name', 'Campagne LinkedIn Pro');

        $this->deleteJson("/api/prestation-offers/{$offer['id']}")->assertNoContent();
        $this->assertSoftDeleted('prestation_offers', ['id' => $offer['id']]);
    }

    public function test_offer_department_must_belong_to_the_agency(): void
    {
        $this->actingAsRole('super-admin');
        $other = Department::factory()->create(['type' => Department::TYPE_AGENCY]);

        $this->postJson('/api/prestation-offers', [
            'agency_id' => $this->agency->id,
            'department_id' => $other->id,
            'name' => 'Hors agence',
        ])->assertStatus(422);
    }

    public function test_offer_is_scoped_to_the_user_agency(): void
    {
        $this->actingAsRole('responsable-agence', Agency::factory()->create());

        $this->getJson('/api/prestation-offers')->assertOk()->assertJsonMissing(['name' => 'Campagne Facebook']);
        $this->getJson("/api/prestation-offers/{$this->offer->id}")->assertStatus(403);
        $this->deleteJson("/api/prestation-offers/{$this->offer->id}")->assertStatus(403);
    }

    // ─── Souscription ────────────────────────────────────────────────────

    public function test_subscription_requires_an_offer_and_inherits_its_scope(): void
    {
        $category = AgencyCategory::create([
            'department_id' => $this->department->id,
            'kind' => AgencyCategory::KIND_PRESTATION,
            'name' => 'Social media',
        ]);
        $this->offer->update(['category_id' => $category->id]);

        $this->actingAsRole('super-admin');

        $this->postJson('/api/prestations', [
            'agency_id' => $this->agency->id,
            'name' => 'Sans offre',
            'client_id' => $this->client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => 100000,
        ])->assertStatus(422)->assertJsonValidationErrors('offer_id');

        $otherDepartment = Department::factory()->create(['type' => Department::TYPE_AGENCY]);
        $prestation = $this->subscribe(['department_id' => $otherDepartment->id]);

        $this->assertSame($this->offer->id, $prestation['offer_id']);
        $this->assertSame($this->agency->id, $prestation['agency_id']);
        $this->assertSame($this->department->id, $prestation['department_id']);
        $this->assertSame($category->id, $prestation['category_id']);
    }

    public function test_subscription_list_is_filtered_by_offer_and_excludes_package_prestations(): void
    {
        $this->actingAsRole('super-admin');
        $first = $this->subscribe();

        $otherOffer = PrestationOffer::create([
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Offre 2',
        ]);
        $second = $this->subscribe(['offer_id' => $otherOffer->id]);

        // Prestation générée par une souscription de pack : aucune offre liée.
        $fromPackage = Prestation::create([
            'reference' => 'PRS-2026-9001',
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Pack Digital',
            'client_id' => $this->client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addYear()->toDateString(),
            'budget' => 1000000,
            'status' => 'validated',
        ]);
        $this->assertNull($fromPackage->fresh()->offer_id);

        $this->getJson("/api/prestations?offer_id={$this->offer->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $first['id']);

        $this->getJson("/api/prestations?offer_id={$otherOffer->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $second['id']);

        // Le suivi général (tracking) garde, lui, toutes les prestations.
        $this->getJson('/api/prestations')->assertOk()->assertJsonPath('total', 3);
    }

    public function test_offer_with_subscriptions_cannot_be_deleted(): void
    {
        $this->actingAsRole('super-admin');
        $this->subscribe();

        $this->deleteJson("/api/prestation-offers/{$this->offer->id}")->assertStatus(422);
        $this->assertDatabaseHas('prestation_offers', ['id' => $this->offer->id, 'deleted_at' => null]);
    }
}
