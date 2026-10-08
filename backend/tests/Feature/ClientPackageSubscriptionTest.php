<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\Role;
use App\Models\SubscriptionPack;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Souscription du client connecté depuis le portail public
 * (POST /api/client/packages/{package}/subscribe).
 */
class ClientPackageSubscriptionTest extends TestCase
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

    private function publicPackage(array $overrides = []): SubscriptionPack
    {
        return SubscriptionPack::create(array_merge([
            'agency_id' => Agency::factory()->create()->id,
            'name' => 'Pack Essentiel',
            'price_per_month' => 100000,
            'billing_period' => 'monthly',
            'is_public' => true,
            'is_active' => true,
        ], $overrides));
    }

    public function test_client_can_subscribe_to_public_package(): void
    {
        $token = $this->authClient();
        $client = $this->clientUser();
        $pack = $this->publicPackage();

        $payload = $this->withToken($token)
            ->postJson('/api/client/packages/'.$pack->id.'/subscribe', [
                'periods' => 2,
                'start_date' => '2026-11-01',
                // Mêmes libellés que la souscription en agence (caissier / commercial).
                'payment_type' => 'om',
                'auto_renew' => true,
                'advance' => 50000,
            ])
            ->assertStatus(201)
            ->json();

        $contract = Contract::findOrFail($payload['contract']['id']);
        $this->assertSame($client->id, $contract->client_id);
        $this->assertSame($pack->id, $contract->pack_id);
        $this->assertSame($pack->agency_id, $contract->agency_id);
        $this->assertSame(Contract::STATUS_PENDING, $contract->status);
        $this->assertNull($contract->commercial_id, 'souscription sans commercial');
        $this->assertSame('2026-11-01', $contract->start_date->toDateString());
        $this->assertEquals(200000.0, (float) $contract->amount, '100000 × 2 périodes');

        $invoice = Invoice::findOrFail($payload['invoice']['id']);
        $this->assertSame('unpaid', $invoice->status);
        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice->validation_status, 'facture à valider par l\'agence');
        $this->assertSame($pack->agency_id, $invoice->agency_id);
        $this->assertSame('om', $invoice->payment_type);
        $this->assertTrue((bool) $contract->auto_renew);
        $this->assertEquals(50000.0, (float) $invoice->declared_advance, 'avance déclarée, encaissée à la validation');
        $this->assertEquals(0.0, (float) $invoice->amount_paid, 'rien encaissé avant validation');
        $this->assertCount(1, $invoice->items);

        $this->assertDatabaseHas('prestations', [
            'id' => $payload['prestation']['id'],
            'agency_id' => $pack->agency_id,
            'client_id' => $client->id,
        ]);
    }

    public function test_client_cannot_subscribe_twice_to_the_same_package(): void
    {
        $token = $this->authClient();
        $pack = $this->publicPackage();

        $this->withToken($token)
            ->postJson('/api/client/packages/'.$pack->id.'/subscribe', ['periods' => 1])
            ->assertStatus(201);

        $this->withToken($token)
            ->postJson('/api/client/packages/'.$pack->id.'/subscribe', ['periods' => 1])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Vous avez déjà une souscription en cours pour ce package.');

        $this->assertSame(1, Contract::where('client_id', $this->clientUser()->id)->count());
    }

    public function test_subscribe_is_restricted_to_public_and_active_packages(): void
    {
        $token = $this->authClient();

        $private = $this->publicPackage(['is_public' => false]);
        $this->withToken($token)
            ->postJson('/api/client/packages/'.$private->id.'/subscribe', ['periods' => 1])
            ->assertNotFound();

        $inactive = $this->publicPackage(['is_active' => false]);
        $this->withToken($token)
            ->postJson('/api/client/packages/'.$inactive->id.'/subscribe', ['periods' => 1])
            ->assertNotFound();

        $this->assertSame(0, Contract::count());
    }

    public function test_guest_cannot_subscribe(): void
    {
        $pack = $this->publicPackage();

        $this->postJson('/api/client/packages/'.$pack->id.'/subscribe', ['periods' => 1])
            ->assertStatus(401);

        $this->assertSame(0, Contract::count());
    }

    public function test_subscribe_validates_payload_and_minimum_duration(): void
    {
        $token = $this->authClient();
        $pack = $this->publicPackage();

        $this->withToken($token)
            ->postJson('/api/client/packages/'.$pack->id.'/subscribe', ['periods' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('periods');

        $this->withToken($token)
            ->postJson('/api/client/packages/'.$pack->id.'/subscribe', [
                'periods' => 1,
                'advance' => 999999,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('advance');

        $engaged = $this->publicPackage(['name' => 'Pack Engagement', 'min_duration_months' => 3]);
        $this->withToken($token)
            ->postJson('/api/client/packages/'.$engaged->id.'/subscribe', ['periods' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors('periods');

        $this->assertSame(0, Contract::count());
    }

    /** Le caissier/direction annule la facture : le contrat en attente est résilié. */
    public function test_cancelling_the_subscription_invoice_terminates_the_pending_contract(): void
    {
        $first = $this->subscribeOnce();

        $admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($admin);
        $this->postJson("/api/invoices/{$first['invoice']['id']}/cancel")->assertOk();

        $this->assertSame(Contract::STATUS_TERMINATED, Contract::find($first['contract']['id'])->status);
        $this->assertSame(Prestation::STATUS_CANCELLED, Prestation::find($first['prestation']['id'])->status);
    }

    /** Le caissier rejette la facture : le contrat en attente est résilié. */
    public function test_rejecting_the_subscription_invoice_terminates_the_pending_contract(): void
    {
        $first = $this->subscribeOnce();

        $admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($admin);
        $this->postJson("/api/invoices/{$first['invoice']['id']}/reject", [
            'rejection_reason' => 'Preuve de paiement illisible',
        ])->assertOk();

        $this->assertSame(Contract::STATUS_TERMINATED, Contract::find($first['contract']['id'])->status);
    }

    /** Après annulation, le client peut souscrire de nouveau au même package. */
    public function test_client_can_resubscribe_after_the_invoice_is_cancelled(): void
    {
        $token = $this->authClient();
        $client = $this->clientUser();
        $pack = $this->publicPackage();

        $first = $this->withToken($token)
            ->postJson("/api/client/packages/{$pack->id}/subscribe", ['periods' => 1])
            ->assertStatus(201)
            ->json();

        // Commande annulée : la facture est annulée (le contrat peut rester en
        // attente pour les données antérieures au correctif).
        Invoice::whereKey($first['invoice']['id'])->update(['cancelled_at' => now(), 'status' => 'cancelled']);

        $this->withToken($token)
            ->postJson("/api/client/packages/{$pack->id}/subscribe", ['periods' => 1])
            ->assertStatus(201);

        $this->assertSame(2, Contract::where('client_id', $client->id)->count());
    }

    /** Après rejet, le client peut souscrire de nouveau au même package. */
    public function test_client_can_resubscribe_after_the_invoice_is_rejected(): void
    {
        $token = $this->authClient();
        $client = $this->clientUser();
        $pack = $this->publicPackage();

        $first = $this->withToken($token)
            ->postJson("/api/client/packages/{$pack->id}/subscribe", ['periods' => 1])
            ->assertStatus(201)
            ->json();

        Invoice::whereKey($first['invoice']['id'])->update([
            'validation_status' => Invoice::VALIDATION_REJECTED,
            'rejection_reason' => 'Preuve illisible',
        ]);

        $this->withToken($token)
            ->postJson("/api/client/packages/{$pack->id}/subscribe", ['periods' => 1])
            ->assertStatus(201);

        $this->assertSame(2, Contract::where('client_id', $client->id)->count());
    }

    /** Suppression par le client de sa facture rejetée → contrat en attente résilié. */
    public function test_deleting_a_rejected_subscription_invoice_terminates_the_pending_contract(): void
    {
        $first = $this->subscribeOnce();
        $invoice = Invoice::findOrFail($first['invoice']['id']);
        $invoice->update(['validation_status' => Invoice::VALIDATION_REJECTED]);

        $this->withToken($first['_token'])
            ->deleteJson('/api/client/invoices/'.$invoice->id)
            ->assertOk();

        $this->assertSame(Contract::STATUS_TERMINATED, Contract::find($first['contract']['id'])->status);
    }

    /** Souscrit une fois en tant que client et renvoie le payload. */
    private function subscribeOnce(): array
    {
        $token = $this->authClient();
        $pack = $this->publicPackage();

        $payload = $this->withToken($token)
            ->postJson("/api/client/packages/{$pack->id}/subscribe", ['periods' => 1])
            ->assertStatus(201)
            ->json();

        $payload['_token'] = $token;

        return $payload;
    }
}
