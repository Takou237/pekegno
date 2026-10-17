<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * « Payer le reste » d'une facture partielle (côté commercial) : le commercial
 * transmet le montant restant + le mode de paiement + une preuve, le caissier
 * accepte, l'encaissement (et le reçu) sont alors générés automatiquement.
 */
class PayRemainingTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
    }

    private function userWithRole(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function commercialUser(Agency $agency = null): User
    {
        $user = $this->userWithRole('commercial');
        Commercial::factory()->create([
            'user_id' => $user->id,
            'agency_id' => ($agency ?? $this->agency)->id,
        ]);

        return $user;
    }

    /**
     * Facture partielle déjà validée : total 100 000, 40 000 déjà encaissés.
     */
    private function partialInvoice(User $commercial, float $total = 100000, float $paid = 40000): Invoice
    {
        $profileId = $commercial->commercialProfile->id;

        return Invoice::create([
            'number' => 'FAC-'.uniqid(),
            'agency_id' => $this->agency->id,
            'client_id' => $this->userWithRole('client')->id,
            'seller_user_id' => $commercial->id,
            'commercial_id' => $profileId,
            'invoice_date' => now()->toDateString(),
            'payment_type' => 'cash',
            'total_amount' => $total,
            'amount_paid' => $paid,
            'declared_advance' => $paid,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'partial',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'validated_at' => now(),
        ]);
    }

    private function submitRemaining(User $user, Invoice $invoice, float $amount, string $method = 'om')
    {
        Sanctum::actingAs($user);

        return $this->post("/api/invoices/{$invoice->id}/pay-remaining", [
            'amount' => $amount,
            'payment_method' => $method,
            'phone_number_used' => '690000000',
            'reference' => 'REF-123',
            'file' => UploadedFile::fake()->image('preuve.png'),
        ]);
    }

    public function test_accepting_remaining_proof_encashes_amount_and_generates_receipt(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial);

        $response = $this->submitRemaining($commercial, $invoice, 60000)->assertStatus(201)->json();

        $proofId = $response['payment_proof']['id'];
        $proof = PaymentProof::findOrFail($proofId);
        $this->assertSame(PaymentProof::STATUS_PENDING, $proof->status);
        $this->assertSame(60000.0, (float) $proof->amount);
        $this->assertSame(40000.0, (float) $invoice->fresh()->amount_paid, 'rien d\'autre n\'est encaissé avant acceptation');

        // Le caissier accepte la preuve de règlement.
        Sanctum::actingAs($this->userWithRole('caissier'));
        $this->postJson("/api/payment-proofs/{$proofId}/approve")->assertOk();

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(100000.0, (float) $invoice->amount_paid);
        $this->assertSame(PaymentProof::STATUS_ACCEPTED, $proof->fresh()->status);

        $payment = $invoice->payments()->latest()->first();
        $this->assertNotNull($payment);
        $this->assertSame(60000.0, (float) $payment->amount);
        $this->assertNotNull($payment->receipt_number, 'un reçu est généré pour le règlement encaissé');
    }

    public function test_accepting_remaining_proof_caps_amount_at_balance_due(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial, total: 100000, paid: 40000);

        // Preuve portant un montant supérieur au reste (cas limite) : on plafonne.
        $proof = PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $commercial->id,
            'payment_method' => 'om',
            'amount' => 999999,
            'file_path' => 'payment-proofs/x.png',
            'status' => PaymentProof::STATUS_PENDING,
        ]);

        Sanctum::actingAs($this->userWithRole('caissier'));
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();

        $this->assertSame(100000.0, (float) $invoice->fresh()->amount_paid, 'le montant est plafonné au reste à payer');
    }

    public function test_cannot_pay_remaining_on_pending_invoice(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial);
        $invoice->update(['validation_status' => Invoice::VALIDATION_PENDING]);

        $this->submitRemaining($commercial, $invoice, 60000)->assertStatus(422);
        $this->assertSame(0, PaymentProof::where('invoice_id', $invoice->id)->count());
    }

    public function test_cannot_pay_remaining_when_already_settled(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial, total: 100000, paid: 100000);
        $invoice->update(['status' => 'paid']);

        $this->submitRemaining($commercial, $invoice, 60000)->assertStatus(422);
    }

    public function test_amount_over_balance_is_rejected(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial, total: 100000, paid: 40000);

        $this->submitRemaining($commercial, $invoice, 70000)
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_only_one_pending_remaining_proof_at_a_time(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial);

        $this->submitRemaining($commercial, $invoice, 30000)->assertStatus(201);
        $this->submitRemaining($commercial, $invoice, 30000)
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $this->assertSame(1, PaymentProof::where('invoice_id', $invoice->id)->where('status', PaymentProof::STATUS_PENDING)->count());
    }

    public function test_commercial_cannot_pay_another_commercials_invoice(): void
    {
        $owner = $this->commercialUser();
        $other = $this->commercialUser();
        $invoice = $this->partialInvoice($owner);

        $this->submitRemaining($other, $invoice, 60000)->assertStatus(403);
    }

    public function test_already_reviewed_proof_cannot_be_approved_twice(): void
    {
        $commercial = $this->commercialUser();
        $invoice = $this->partialInvoice($commercial);
        $response = $this->submitRemaining($commercial, $invoice, 60000)->assertStatus(201)->json();
        $proofId = $response['payment_proof']['id'];

        Sanctum::actingAs($this->userWithRole('caissier'));
        $this->postJson("/api/payment-proofs/{$proofId}/approve")->assertOk();
        $this->postJson("/api/payment-proofs/{$proofId}/approve")->assertStatus(422);

        $this->assertSame(1, $invoice->fresh()->payments()->count(), 'un seul encaissement pour une seule preuve');
    }
}
