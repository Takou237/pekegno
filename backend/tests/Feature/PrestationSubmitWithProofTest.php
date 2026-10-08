<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Prestation;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * « Soumettre une prestation avec preuve » (P1-P3) : le commercial déclare
 * l'avance, la facture naît en attente et le caissier encaisse en acceptant la
 * preuve — sans double encaissement.
 */
class PrestationSubmitWithProofTest extends TestCase
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

    private function commercialUser(): User
    {
        $user = $this->userWithRole('commercial');
        Commercial::factory()->create([
            'user_id' => $user->id,
            'agency_id' => $this->agency->id,
        ]);

        return $user;
    }

    private function createPrestation(User $client, float $budget = 500000): array
    {
        return $this->postJson('/api/prestations', [
            'agency_id' => $this->agency->id,
            'department_id' => $this->department->id,
            'name' => 'Lancement réseaux sociaux',
            'client_id' => $client->id,
            'start_date' => today()->toDateString(),
            'end_date' => today()->addMonth()->toDateString(),
            'budget' => $budget,
        ])->assertStatus(201)->json();
    }

    public function test_commercial_submit_with_proof_creates_pending_invoice_and_proof(): void
    {
        $commercial = $this->commercialUser();
        Sanctum::actingAs($commercial);
        $client = $this->userWithRole('client');

        $prestation = $this->createPrestation($client);

        $response = $this->post("/api/prestations/{$prestation['id']}/submit", [
            'amount_paid' => 200000,
            'payment_type' => 'cash',
            'proof' => UploadedFile::fake()->image('preuve.png'),
        ])->assertOk()->json();

        $this->assertSame(Prestation::STATUS_PENDING_VALIDATION, $response['status']);
        $this->assertSame(200000.0, (float) $response['declared_advance_amount']);
        $this->assertNotNull($response['payment_proof_id']);
        $this->assertNotNull($response['submitted_with_proof_at']);

        $model = Prestation::findOrFail($prestation['id']);
        $this->assertNotNull($model->contract_id, 'le contrat est créé à la soumission avec preuve');

        $invoice = Invoice::where('contract_id', $model->contract_id)->firstOrFail();
        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice->validation_status);
        $this->assertSame(200000.0, (float) $invoice->declared_advance);
        $this->assertSame(0.0, (float) $invoice->amount_paid, 'pas d\'encaissement avant acceptation de la preuve');

        $proof = PaymentProof::where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertSame(PaymentProof::STATUS_PENDING, $proof->status);
        $this->assertSame($model->payment_proof_id, $proof->id);
    }

    public function test_cashier_approving_proof_validates_invoice_and_collects_declared_advance(): void
    {
        $commercial = $this->commercialUser();
        Sanctum::actingAs($commercial);
        $client = $this->userWithRole('client');
        $prestation = $this->createPrestation($client);

        $this->post("/api/prestations/{$prestation['id']}/submit", [
            'amount_paid' => 150000,
            'payment_type' => 'om',
            'proof' => UploadedFile::fake()->image('preuve.png'),
        ])->assertOk();

        $model = Prestation::findOrFail($prestation['id']);
        $invoice = Invoice::where('contract_id', $model->contract_id)->firstOrFail();
        $proof = PaymentProof::where('invoice_id', $invoice->id)->firstOrFail();

        Sanctum::actingAs($this->userWithRole('caissier'));
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();

        $invoice->refresh();
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice->validation_status);
        $this->assertSame(150000.0, (float) $invoice->amount_paid, 'l\'avance déclarée est encaissée une seule fois');
        $this->assertSame(PaymentProof::STATUS_ACCEPTED, $proof->fresh()->status);
    }

    public function test_submit_without_proof_only_transitions_and_creates_no_invoice(): void
    {
        $admin = $this->userWithRole('super-admin');
        Sanctum::actingAs($admin);
        $client = $this->userWithRole('client');
        $prestation = $this->createPrestation($client);

        $response = $this->postJson("/api/prestations/{$prestation['id']}/submit")->assertOk()->json();

        $this->assertSame(Prestation::STATUS_PENDING_VALIDATION, $response['status']);
        $this->assertNull($response['payment_proof_id']);
        $this->assertNull($response['declared_advance_amount']);
        $this->assertSame(0, Invoice::count());
    }

    public function test_declared_amount_requires_a_proof_file(): void
    {
        $admin = $this->userWithRole('super-admin');
        Sanctum::actingAs($admin);
        $client = $this->userWithRole('client');
        $prestation = $this->createPrestation($client);

        $this->postJson("/api/prestations/{$prestation['id']}/submit", [
            'amount_paid' => 100000,
            'payment_type' => 'cash',
        ])->assertStatus(422)->assertJsonValidationErrors('proof');
    }
}