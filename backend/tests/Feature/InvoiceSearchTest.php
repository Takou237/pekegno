<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createInvoice(array $attributes = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'items' => [
                ['label' => 'Formation', 'unit_price' => 8000, 'quantity' => 1],
            ],
        ], $attributes))->assertStatus(201)->json();
    }

    public function test_search_invoices_by_number(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->createInvoice();

        $this->getJson('/api/invoices?search='.$invoice['number'])
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.id', $invoice['id']);
    }

    public function test_search_invoices_by_free_text_client_name(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['client_name' => 'Mwana Kekete']);
        $this->createInvoice(['client_name' => 'Autre Client']);

        $this->getJson('/api/invoices?search=Kekete')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.client_name', 'Mwana Kekete');
    }

    public function test_search_invoices_by_linked_client_first_name(): void
    {
        $this->actingAsAdmin();

        $client = $this->postJson('/api/clients', [
            'first_name' => 'Brice',
            'last_name' => 'Ngo',
            'email' => 'brice@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(201)->json();

        $this->createInvoice(['client_id' => $client['id']]);
        $this->createInvoice();

        $this->getJson('/api/invoices?search=Brice')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.client_id', $client['id']);
    }

    public function test_search_invoices_by_linked_client_last_name_or_email(): void
    {
        $this->actingAsAdmin();

        $client = $this->postJson('/api/clients', [
            'first_name' => 'Aline',
            'last_name' => 'Fotso',
            'email' => 'aline.fotso@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(201)->json();

        $this->createInvoice(['client_id' => $client['id']]);

        $this->getJson('/api/invoices?search=Fotso')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.client_id', $client['id']);

        $this->getJson('/api/invoices?search=aline.fotso')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.client_id', $client['id']);
    }

    public function test_search_does_not_return_other_invoices(): void
    {
        $this->actingAsAdmin();

        $this->createInvoice(['client_name' => 'Cible Unique']);

        for ($i = 0; $i < 3; $i++) {
            $this->createInvoice(['client_name' => "Autre {$i}"]);
        }

        $this->getJson('/api/invoices?search=Cible')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.client_name', 'Cible Unique');

        $this->getJson('/api/invoices?search=Inexistant')
            ->assertOk()
            ->assertJsonCount(0, 'invoices.data');
    }

    public function test_filter_invoices_by_client_id(): void
    {
        $this->actingAsAdmin();

        $client = $this->postJson('/api/clients', [
            'first_name' => 'Client',
            'last_name' => 'Filtre',
            'email' => 'filtre@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertStatus(201)->json();

        $this->createInvoice(['client_id' => $client['id']]);
        $this->createInvoice();

        $this->getJson('/api/invoices?client_id='.$client['id'])
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.client_id', $client['id']);
    }

    public function test_commercial_only_sees_own_invoices(): void
    {
        $agency = Agency::factory()->create();

        $commercialUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        $commercial = Commercial::factory()->create([
            'user_id' => $commercialUser->id,
            'agency_id' => $agency->id,
        ]);

        $otherUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        $other = Commercial::factory()->create([
            'user_id' => $otherUser->id,
            'agency_id' => $agency->id,
        ]);

        $this->actingAsAdmin();

        $this->postJson('/api/invoices', [
            'commercial_id' => $commercial->id,
            'agency_id' => $agency->id,
            'items' => [
                ['label' => 'Vente commercial 1', 'unit_price' => 5000, 'quantity' => 1],
            ],
        ])->assertStatus(201);

        $this->postJson('/api/invoices', [
            'commercial_id' => $other->id,
            'agency_id' => $agency->id,
            'items' => [
                ['label' => 'Vente commercial 2', 'unit_price' => 6000, 'quantity' => 1],
            ],
        ])->assertStatus(201);

        Sanctum::actingAs($commercialUser);

        $this->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.commercial_id', $commercial->id);
    }

    public function test_caissier_only_sees_own_agencies_invoices(): void
    {
        $agencyA = Agency::factory()->create();
        $agencyB = Agency::factory()->create();

        $caissier = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        $caissier->assignments()->sync([$agencyA->id => ['is_primary' => true]]);

        $this->actingAsAdmin();

        $invoiceA = $this->postJson('/api/invoices', [
            'agency_id' => $agencyA->id,
            'items' => [
                ['label' => 'Vente agence A', 'unit_price' => 5000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->postJson('/api/invoices', [
            'agency_id' => $agencyB->id,
            'items' => [
                ['label' => 'Vente agence B', 'unit_price' => 6000, 'quantity' => 1],
            ],
        ])->assertStatus(201);

        Sanctum::actingAs($caissier);

        $this->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.id', $invoiceA['id']);
    }
}
