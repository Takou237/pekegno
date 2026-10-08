<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\Prestation;
use App\Models\Role;
use App\Models\SubscriptionPack;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T1/T3 (doc/TODO_Agency.md §9) : le caissier — permission K1 — crée/valide
 * directement les prestations et souscrit des packages au guichet.
 */
class CashierAgencyActionsTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            CitySeeder::class,
        ]);

        $this->agency = Agency::factory()->create();
        $this->department = Department::factory()->create([
            'agency_id' => $this->agency->id,
            'type' => Department::TYPE_AGENCY,
        ]);
    }

    private function userWithRole(string $role, ?Agency $agency = null): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);

        if ($agency) {
            DB::table('user_assignments')->insert([
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                'department_id' => null,
                'is_primary' => true,
                'is_department_chief' => false,
            ]);
        }

        return $user;
    }

    private function commercial(?Agency $agency = null): User
    {
        $agency ??= $this->agency;
        $user = $this->userWithRole('commercial');
        Commercial::factory()->create(['user_id' => $user->id, 'agency_id' => $agency->id]);

        return $user;
    }

    private function createPackage(float $price = 100000): SubscriptionPack
    {
        return SubscriptionPack::findOrFail(
            $this->postJson('/api/packages', [
                'agency_id' => $this->agency->id,
                'department_id' => $this->department->id,
                'name' => 'Offre Test',
                'price_per_month' => $price,
                'billing_period' => 'monthly',
                'items' => [
                    ['label' => 'Community management', 'quantity' => 1, 'frequency' => 'per_month', 'action_type' => 'community_management'],
                ],
            ])->assertStatus(201)->json('id')
        );
    }

    // ─── T3 : le caissier crée puis valide une prestation ─────────────────

    public function test_caissier_creates_and_validates_prestation_directly(): void
    {
        Sanctum::actingAs($this->userWithRole('caissier', $this->agency));
        $client = $this->userWithRole('client');

        $prestation = $this->postJson('/api/prestations', [
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Prestation guichet',
            'client_id' => $client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => 250000,
        ])->assertStatus(201)->json();

        $this->postJson("/api/prestations/{$prestation['id']}/submit")->assertOk();
        $this->postJson("/api/prestations/{$prestation['id']}/validate")
            ->assertOk()
            ->assertJsonPath('status', 'validated');

        $model = Prestation::findOrFail($prestation['id']);
        $this->assertNotNull($model->contract_id);
        $this->assertSame('pending', $model->contract->status);
        $this->assertSame(1, Invoice::where('contract_id', $model->contract_id)->count());
    }

    public function test_commercial_still_cannot_validate_prestation(): void
    {
        $admin = $this->userWithRole('super-admin');
        Sanctum::actingAs($admin);
        $client = $this->userWithRole('client');
        $prestation = $this->postJson('/api/prestations', [
            'agency_id' => $this->agency->id,
            'name' => 'Prestation',
            'client_id' => $client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => 100000,
        ])->assertStatus(201)->json();
        $this->postJson("/api/prestations/{$prestation['id']}/submit")->assertOk();

        Sanctum::actingAs($this->commercial());
        $this->postJson("/api/prestations/{$prestation['id']}/validate")->assertStatus(403);
    }

    // ─── T1 : souscription package au guichet (caissier + commercial) ─────

    public function test_caissier_subscribes_package_without_proof(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $package = $this->createPackage();
        $client = $this->userWithRole('client');

        Sanctum::actingAs($this->userWithRole('caissier', $this->agency));
        $response = $this->postJson("/api/packages/{$package->id}/subscribe", [
            'client_id' => $client->id,
            'periods' => 2,
            'advance' => 50000,
            'payment_type' => 'cash',
        ])->assertStatus(201)->json();

        // L'avance encaissée immédiatement active le contrat (D10).
        $this->assertSame('active', $response['contract']['status']);
        // Le premier paiement démarre aussi la prestation (D10).
        $this->assertSame('in_progress', $response['prestation']['status']);
        $this->assertSame(200000.0, (float) $response['invoice']['total_amount']);
        // Avance encaissée immédiatement (facture définitive pour un caissier).
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $response['invoice']['validation_status']);
        $this->assertSame(50000.0, (float) $response['invoice']['amount_paid']);
    }

    public function test_commercial_subscribes_package_with_proof_pending(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $package = $this->createPackage();
        $client = $this->userWithRole('client');

        Sanctum::actingAs($this->commercial());
        $response = $this->post("/api/packages/{$package->id}/subscribe", [
            'client_id' => $client->id,
            'periods' => 1,
            'advance' => 30000,
            'payment_type' => 'om',
            'proof_file' => UploadedFile::fake()->image('preuve.png'),
        ])->assertStatus(201)->json();

        $this->assertSame(Invoice::VALIDATION_PENDING, $response['invoice']['validation_status']);
        $this->assertSame(0.0, (float) $response['invoice']['amount_paid'], 'encaissement différé jusqu\'à validation de la preuve');
        $this->assertDatabaseHas('payment_proofs', ['invoice_id' => $response['invoice']['id']]);
    }

    public function test_commercial_subscribe_requires_proof(): void
    {
        Sanctum::actingAs($this->userWithRole('super-admin'));
        $package = $this->createPackage();
        $client = $this->userWithRole('client');

        Sanctum::actingAs($this->commercial());
        $this->postJson("/api/packages/{$package->id}/subscribe", [
            'client_id' => $client->id,
            'periods' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors('proof_file');
    }
}