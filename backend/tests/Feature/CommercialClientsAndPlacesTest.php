<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Prospect;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cahier §5 : un commercial ne voit que ses clients et ses prospects.
 * B27 : classements du Rapport clients par pays et par ville ; filtre par ville.
 */
class CommercialClientsAndPlacesTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function client(?User $commercial, array $extra = []): User
    {
        $this->seq++;

        return User::factory()->create(array_merge([
            'role_id' => Role::where('name', 'client')->value('id'),
            'email' => "client{$this->seq}@example.com",
            'phone' => '6900000'.str_pad((string) $this->seq, 2, '0', STR_PAD_LEFT),
            'commercial_user_id' => $commercial?->id,
        ], $extra));
    }

    private function commercial(Agency $agency): User
    {
        $user = $this->user('commercial');
        $user->assignments()->sync([$agency->id => ['is_primary' => false]]);
        Commercial::create(['user_id' => $user->id, 'agency_id' => $agency->id, 'first_name' => 'C', 'last_name' => (string) $user->id, 'is_active' => true]);

        return $user->fresh();
    }

    public function test_commercial_only_sees_the_clients_he_added(): void
    {
        $agency = Agency::factory()->create();
        $me = $this->commercial($agency);
        $other = $this->commercial($agency);
        $mine = $this->client($me);
        $theirs = $this->client($other);
        $orphan = $this->client(null);

        Sanctum::actingAs($me);

        $ids = collect($this->getJson('/api/clients?per_page=100')->assertOk()->json('data'))->pluck('id');
        $this->assertEquals([$mine->id], $ids->all());
        $this->getJson("/api/clients/{$mine->id}")->assertOk();
        $this->getJson("/api/clients/{$theirs->id}")->assertNotFound();
        $this->getJson("/api/clients/{$orphan->id}")->assertNotFound();
        $this->putJson("/api/clients/{$theirs->id}", ['first_name' => 'X'])->assertNotFound();

        // Recherche pour une vente : un client d'un autre n'est retrouvé que par
        // son email ou son téléphone exacts, jamais en parcourant.
        $this->assertSame([$mine->id], collect($this->getJson('/api/clients/search?q=client')->json())->pluck('id')->all());
        $this->assertSame([$theirs->id], collect($this->getJson('/api/clients/search?q='.urlencode($theirs->email))->json())->pluck('id')->all());

        // Un client créé par le commercial lui appartient, quoi qu'envoie l'écran.
        $created = $this->postJson('/api/clients', [
            'first_name' => 'Nouveau', 'last_name' => 'Client', 'email' => 'nouveau@example.com',
            'commercial_user_id' => $other->id,
        ])->assertCreated()->json();
        $this->assertSame($me->id, User::find($created['data']['id'] ?? $created['id'])->commercial_user_id);

        // Les autres rôles voient tous les clients.
        Sanctum::actingAs($this->user('super-admin'));
        $this->assertCount(4, $this->getJson('/api/clients?per_page=100')->json('data'));
    }

    public function test_commercial_only_sees_his_prospects(): void
    {
        $agency = Agency::factory()->create();
        $me = $this->commercial($agency);
        $other = $this->commercial($agency);
        $base = ['agency_id' => $agency->id, 'last_name' => 'P', 'status' => 'new'];

        $added = Prospect::create($base + ['first_name' => 'Ajouté', 'created_by' => $me->id, 'commercial_id' => $other->commercialProfile->id]);
        $assigned = Prospect::create($base + ['first_name' => 'Attribué', 'created_by' => $other->id, 'commercial_id' => $me->commercialProfile->id]);
        $foreign = Prospect::create($base + ['first_name' => 'Autre', 'created_by' => $other->id, 'commercial_id' => $other->commercialProfile->id]);

        Sanctum::actingAs($me);

        $names = collect($this->getJson('/api/prospects?per_page=100')->assertOk()->json('data'))->pluck('first_name')->sort()->values();
        $this->assertEquals(['Ajouté', 'Attribué'], $names->all());
        $this->getJson("/api/prospects/{$foreign->id}")->assertNotFound();
    }

    public function test_customers_report_ranks_free_text_countries_and_cities(): void
    {
        Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF', 'exchange_rate' => 1, 'is_active' => true]);
        Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'iso_code' => 'CI', 'currency_code' => 'XOF', 'exchange_rate' => 1, 'is_active' => true]);
        foreach ([['Cameroun', 'Douala'], ['Cameroon', 'DOUALA'], ['CAMEROUN', 'Douala - Cité SIC'], ['Cameroun', 'Yaoundé'], ['Ivory Coast', 'Abidjan'], [null, null]] as [$country, $city]) {
            $this->client(null, ['country' => $country, 'city' => $city]);
        }

        Sanctum::actingAs($this->user('super-admin'));
        $report = $this->getJson('/api/reports/customers?from=2020-01-01&to=2030-12-31')->assertOk()->json();

        $countries = collect($report['by_country'])->pluck('count', 'country');
        $this->assertSame(4, $countries['Cameroun']);
        $this->assertSame(1, $countries["Côte d'Ivoire"]);
        $this->assertSame(1, $countries['Non renseigné']);

        $cities = collect($report['by_city'])->pluck('count', 'city');
        $this->assertSame(3, $cities['Douala']);
        $this->assertSame(1, $cities['Yaoundé']);

        // Rapport limité à un pays, puis à une ville (graphies regroupées).
        $cameroun = $this->getJson('/api/reports/customers?from=2020-01-01&to=2030-12-31&country=Cameroon')->assertOk()->json();
        $this->assertSame(4, $cameroun['totals']['clients_total']);
        $this->assertSame(['Cameroun'], collect($cameroun['by_country'])->pluck('country')->all());
        $this->assertContains("Côte d'Ivoire", $cameroun['place_options']['countries']);
        $douala = $this->getJson('/api/reports/customers?from=2020-01-01&to=2030-12-31&city=douala')->assertOk()->json();
        $this->assertSame(3, $douala['totals']['clients_total']);

        // Filtre des clients par ville : toutes les graphies de Douala.
        $this->assertCount(3, $this->getJson('/api/clients?city=Douala&per_page=100')->assertOk()->json('data'));
        $this->assertContains('Douala', collect($this->getJson('/api/clients/cities')->assertOk()->json())->pluck('name')->all());
    }
}
