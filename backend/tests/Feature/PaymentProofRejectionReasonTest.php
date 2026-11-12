<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B25 — le rejet d'une preuve de paiement porte un motif choisi dans une liste
 * fermée (dont « Date échue »), la précision libre restant possible.
 */
class PaymentProofRejectionReasonTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function reviewer(): User
    {
        return User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
    }

    private function pendingProof(float $total = 10000): PaymentProof
    {
        $agency = Agency::factory()->create();
        $this->seq++;

        $invoice = Invoice::create([
            'number' => sprintf('PK-B25-%03d', $this->seq),
            'agency_id' => $agency->id,
            'invoice_date' => '2026-11-12',
            'total_amount' => $total,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_PENDING,
            'source' => 'in_person',
        ]);

        return PaymentProof::create([
            'invoice_id' => $invoice->id,
            'payment_method' => 'momo',
            'amount' => $total,
            'file_path' => 'payment-proofs/test.jpg',
            'status' => PaymentProof::STATUS_PENDING,
        ]);
    }

    public function test_rejection_accepts_expired_date_reason_and_journals_it(): void
    {
        $proof = $this->pendingProof();
        Sanctum::actingAs($this->reviewer());

        $this->postJson("/api/payment-proofs/{$proof->id}/reject", [
            'rejection_code' => 'expired_date',
        ])->assertOk();

        $proof->refresh();
        $this->assertSame(PaymentProof::STATUS_REJECTED, $proof->status);
        $this->assertSame('expired_date', $proof->rejection_code);

        $invoice = Invoice::findOrFail($proof->invoice_id);
        $this->assertSame(Invoice::VALIDATION_REJECTED, $invoice->validation_status);
        $this->assertStringContainsString('Date échue', (string) $invoice->rejection_reason);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'proof_rejected',
            'entity_id' => $proof->invoice_id,
        ]);
    }

    public function test_rejection_combines_reason_and_free_text(): void
    {
        $proof = $this->pendingProof();
        Sanctum::actingAs($this->reviewer());

        $this->postJson("/api/payment-proofs/{$proof->id}/reject", [
            'rejection_code' => 'wrong_amount',
            'notes' => 'Annoncé 5 000 au lieu de 10 000.',
        ])->assertOk();

        $proof->refresh();
        $this->assertSame('wrong_amount', $proof->rejection_code);
        $this->assertSame('Annoncé 5 000 au lieu de 10 000.', $proof->notes);

        $invoice = Invoice::findOrFail($proof->invoice_id);
        $this->assertStringContainsString('Montant erroné', (string) $invoice->rejection_reason);
        $this->assertStringContainsString('Annoncé 5 000 au lieu de 10 000.', (string) $invoice->rejection_reason);
    }

    public function test_other_reason_requires_details(): void
    {
        $proof = $this->pendingProof();
        Sanctum::actingAs($this->reviewer());

        $this->postJson("/api/payment-proofs/{$proof->id}/reject", [
            'rejection_code' => 'other',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['notes']);

        $this->assertSame(PaymentProof::STATUS_PENDING, $proof->fresh()->status);
    }

    public function test_unknown_reason_is_rejected(): void
    {
        $proof = $this->pendingProof();
        Sanctum::actingAs($this->reviewer());

        $this->postJson("/api/payment-proofs/{$proof->id}/reject", [
            'rejection_code' => 'not_a_reason',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_code']);
    }

    public function test_legacy_notes_only_rejection_still_works(): void
    {
        $proof = $this->pendingProof();
        Sanctum::actingAs($this->reviewer());

        $this->postJson("/api/payment-proofs/{$proof->id}/reject", [
            'notes' => 'Capture illisible.',
        ])->assertOk();

        $proof->refresh();
        $this->assertNull($proof->rejection_code);
        $this->assertSame('Capture illisible.', $proof->notes);
    }
}
