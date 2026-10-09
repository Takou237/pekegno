<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Souscription du client connecté à une offre de prestation depuis le
 * catalogue public (POST /api/client/offers/{offer}/subscribe).
 * Miroir de l'inscription à une formation : la prestation naît « en attente
 * de validation », le contrat et la facture suivent à la validation.
 */
class ClientOfferSubscriptionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            ClientCategorySeeder::class,
        ]);
    }

    private function registerClient(array $attributes = []): array
    {
        return $this->postJson('/api/client/register', array_merge([
            'first_name' => 'Claire',
            'last_name' => 'Client',
            'email' => 'claire@example.com',
            'phone' => '+237690000000',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], $attributes))->assertStatus(201)->json();
    }

    private function authClient(): string
    {
        $this->registerClient();

        return $this->postJson('/api/client/login', [
            'email' => 'claire@example.com',
            'password' => 'password123',
        ])->assertOk()->json('token');
    }

    private function clientUser(): User
    {
        return User::where('email', 'claire@example.com')->firstOrFail();
    }

    private function activeOffer(array $overrides = []): PrestationOffer
    {
        return PrestationOffer::create(array_merge([
            'agency_id' => Agency::factory()->create()->id,
            'name' => 'Instagram Boost',
            'description' => 'Coup de pouce sur Instagram',
            'is_active' => true,
        ], $overrides));
    }

    public function test_client_can_subscribe_to_active_offer(): void
    {
        $token = $this->authClient();
        $client = $this->clientUser();
        $offer = $this->activeOffer();

        $payload = $this->withToken($token)
            ->postJson('/api/client/offers/'.$offer->id.'/subscribe', [
                'budget' => 150000,
                'start_date' => '2026-11-01',
                'end_date' => '2026-11-30',
            ])
            ->assertStatus(201)
            ->json();

        $prestation = Prestation::findOrFail($payload['prestation']['id']);
        $this->assertSame($client->id, $prestation->client_id);
        $this->assertSame($offer->id, $prestation->offer_id);
        $this->assertSame($offer->agency_id, $prestation->agency_id);
        $this->assertSame($offer->name, $prestation->name);
        $this->assertEquals(150000.0, (float) $prestation->budget);
        $this->assertSame(Prestation::STATUS_PENDING_VALIDATION, $prestation->status);
        $this->assertNull($prestation->contract_id, 'contrat créé à la validation par l\'agence');
    }

    public function test_client_cannot_subscribe_twice_to_the_same_offer(): void
    {
        $token = $this->authClient();
        $offer = $this->activeOffer();
        $body = ['budget' => 50000, 'start_date' => '2026-11-01', 'end_date' => '2026-11-30'];

        $this->withToken($token)
            ->postJson('/api/client/offers/'.$offer->id.'/subscribe', $body)
            ->assertStatus(201);

        $this->withToken($token)
            ->postJson('/api/client/offers/'.$offer->id.'/subscribe', $body)
            ->assertStatus(409)
            ->assertJsonPath('message', 'Vous avez déjà une souscription en cours pour cette prestation.');

        $this->assertSame(1, Prestation::where('client_id', $this->clientUser()->id)->count());
    }

    public function test_client_cannot_subscribe_to_inactive_offer(): void
    {
        $token = $this->authClient();
        $offer = $this->activeOffer(['is_active' => false]);

        $this->withToken($token)
            ->postJson('/api/client/offers/'.$offer->id.'/subscribe', [
                'budget' => 50000,
                'start_date' => '2026-11-01',
                'end_date' => '2026-11-30',
            ])
            ->assertStatus(404);
    }
}
