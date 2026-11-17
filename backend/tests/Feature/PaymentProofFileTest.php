<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\PaymentProof;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Point 3 des corrections du 16/11/2026 : les preuves de paiement sont servies
 * par l'API via une URL signée, au lieu de `/storage/...`.
 */
class PaymentProofFileTest extends TestCase
{
    use RefreshDatabase;

    private function proof(?string $path = 'payment-proofs/preuve.jpg'): PaymentProof
    {
        $agency = Agency::factory()->create();

        $invoice = Invoice::create([
            'number' => 'PK-PROOF-'.uniqid(),
            'agency_id' => $agency->id,
            'invoice_date' => '2026-11-16',
            'total_amount' => 10000,
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
            'amount' => 10000,
            'file_path' => $path,
            'status' => PaymentProof::STATUS_PENDING,
        ]);
    }

    public function test_the_signed_url_serves_the_proof_file(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('payment-proofs/preuve.jpg', 'contenu-image');

        $proof = $this->proof();

        $url = $proof->toArray()['file_url'];
        $this->assertNotNull($url);
        $this->assertStringContainsString('/api/payment-proofs/'.$proof->id.'/file', $url);

        $response = $this->get($url);

        $response->assertOk();
        $this->assertSame('contenu-image', $response->streamedContent() ?: $response->getContent());
    }

    public function test_the_file_route_refuses_an_unsigned_request(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('payment-proofs/preuve.jpg', 'contenu-image');

        $proof = $this->proof();

        $this->get('/api/payment-proofs/'.$proof->id.'/file')->assertForbidden();
    }

    public function test_a_missing_file_returns_not_found(): void
    {
        Storage::fake('public');

        $proof = $this->proof('payment-proofs/absent.jpg');

        $this->get($proof->file_url)->assertNotFound();
    }
}
