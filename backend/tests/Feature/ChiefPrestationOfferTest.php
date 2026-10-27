<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\PrestationOffer;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Vente inter-agences des prestations : un chef d'agence crée une offre dans
 * son agence et souscrit l'offre d'une autre agence ; la gestion reste scopée.
 */
class ChiefPrestationOfferTest extends TestCase
{
    use RefreshDatabase;

    private Agency $own;

    private Agency $other;

    private User $chief;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->own = Agency::factory()->create();
        $this->other = Agency::factory()->create();
        $this->chief = User::factory()->create(['role_id' => Role::where('name', 'responsable-agence')->value('id')]);
        $this->chief->assignments()->attach($this->own->id, ['is_primary' => true, 'is_department_chief' => false]);
        Sanctum::actingAs($this->chief);
    }

    private function client(): User
    {
        return User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);
    }

    public function test_chief_creates_offer_in_own_agency(): void
    {
        $this->postJson('/api/prestation-offers', ['name' => 'Community management', 'agency_id' => $this->own->id])
            ->assertCreated();
    }

    public function test_offer_list_for_sale_includes_other_agencies_but_management_stays_scoped(): void
    {
        PrestationOffer::create(['agency_id' => $this->other->id, 'name' => 'Offre B', 'is_active' => true]);

        $this->assertCount(0, $this->getJson('/api/prestation-offers')->assertOk()->json('data'));
        $this->assertCount(1, $this->getJson('/api/prestation-offers?for_sale=1')->assertOk()->json('data'));
    }

    public function test_chief_subscribes_offer_of_another_agency_and_keeps_access(): void
    {
        $offer = PrestationOffer::create(['agency_id' => $this->other->id, 'name' => 'Offre B', 'is_active' => true]);

        $id = $this->postJson('/api/prestations', [
            'offer_id' => $offer->id,
            'name' => 'Offre B',
            'client_id' => $this->client()->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'budget' => 100000,
        ])->assertCreated()->assertJsonPath('agency_id', $this->other->id)->json('id');

        $this->getJson("/api/prestations/{$id}")->assertOk();
    }
}
