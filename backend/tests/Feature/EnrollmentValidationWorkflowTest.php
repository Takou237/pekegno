<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Course;
use App\Models\Invoice;
use App\Models\InvoicePayment;
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

class EnrollmentValidationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function userWithRole(string $roleName): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function createCommercialUser(): User
    {
        $agency = Agency::factory()->create();
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);

        Commercial::factory()->create([
            'user_id' => $user->id,
            'agency_id' => $agency->id,
        ]);

        Sanctum::actingAs($user);

        return $user;
    }

    private function createClient(): User
    {
        return User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
    }

    private function createCourse(): Course
    {
        return Course::factory()->create(['price' => 50000]);
    }

    public function test_commercial_enrollment_creates_pending_invoice_with_declared_advance(): void
    {
        $commercial = $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'amount_paid' => 10000,
        ])->assertCreated()->json();

        $invoice = Invoice::find($response['invoice_id']);

        $this->assertNotNull($invoice);
        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice->validation_status);
        // Le commercial ne manie pas la caisse : le montant annoncé devient une avance déclarée.
        $this->assertSame(0.0, (float) $invoice->amount_paid);
        $this->assertSame(10000.0, (float) $invoice->declared_advance);
        $this->assertSame('unpaid', $invoice->status);
        $this->assertSame($commercial->id, $invoice->seller_user_id);
    }

    public function test_enrollment_applies_percent_discount(): void
    {
        $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'discount_type' => 'percent',
            'discount_value' => 10,
        ])->assertCreated()->json();

        // La saisie est tracée sur l'inscription…
        $this->assertSame('percent', $response['discount_type']);
        $this->assertSame(10.0, (float) $response['discount_value']);

        // …et la facture porte la remise en montant, comme une facture au guichet.
        $invoice = Invoice::find($response['invoice_id']);
        $this->assertSame(5000.0, (float) $invoice->discount);
        $this->assertSame(45000.0, (float) $invoice->total_amount);
        $this->assertSame(45000.0, $invoice->balance_due);
        // La ligne conserve le prix catalogue.
        $this->assertSame(50000.0, (float) $invoice->items()->first()->line_total);
    }

    public function test_enrollment_applies_fixed_amount_discount_and_caps_payment(): void
    {
        $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'discount_type' => 'amount',
            'discount_value' => 15000,
            // Le vendeur annonce le prix catalogue : le trop-perçu est borné au net.
            'amount_paid' => 50000,
        ])->assertCreated()->json();

        $invoice = Invoice::find($response['invoice_id']);

        $this->assertSame(15000.0, (float) $invoice->discount);
        $this->assertSame(35000.0, (float) $invoice->total_amount);
        $this->assertSame(35000.0, (float) $invoice->amount_paid);
        $this->assertSame('paid', $invoice->status);
        $this->assertStringContainsString('Remise', $invoice->comment);
    }

    public function test_enrollment_rejects_discount_above_course_price(): void
    {
        $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'discount_type' => 'amount',
            'discount_value' => 60000,
        ])->assertStatus(422)->assertJsonValidationErrors('discount_value');

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'discount_type' => 'percent',
            'discount_value' => 120,
        ])->assertStatus(422)->assertJsonValidationErrors('discount_value');

        $this->assertDatabaseMissing('formation_enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
        ]);
    }

    public function test_commercial_enrollment_discount_applies_to_pending_invoice_advance(): void
    {
        $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'discount_type' => 'percent',
            'discount_value' => 20,
            'amount_paid' => 40000,
        ])->assertCreated()->json();

        $invoice = Invoice::find($response['invoice_id']);

        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice->validation_status);
        $this->assertSame(10000.0, (float) $invoice->discount);
        $this->assertSame(40000.0, (float) $invoice->total_amount);
        $this->assertSame(0.0, (float) $invoice->amount_paid);
        $this->assertSame(40000.0, (float) $invoice->declared_advance);
    }

    public function test_commercial_can_attach_payment_proof_at_enrollment_creates_proof(): void
    {
        Storage::fake('public');

        $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->post('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'amount_paid' => 10000,
            'payment_type' => 'momo',
            'proof_file' => UploadedFile::fake()->image('recu-inscription.jpg'),
        ])->assertCreated()->json();

        $invoiceId = $enrollment['invoice_id'];

        // La preuve est rattachée à la facture d'inscription, en attente d'examen.
        $proof = PaymentProof::where('invoice_id', $invoiceId)->first();
        $this->assertNotNull($proof);
        $this->assertSame(PaymentProof::STATUS_PENDING, $proof->status);
        $this->assertSame('momo', $proof->payment_method);
        Storage::disk('public')->assertExists($proof->file_path);

        // La facture reste en attente : le caissier décide après examen de la preuve.
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'validation_status' => Invoice::VALIDATION_PENDING,
        ]);
    }

    public function test_cashier_validating_enrollment_invoice_applies_declared_advance(): void
    {
        $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'amount_paid' => 10000,
        ])->assertCreated()->json();

        $invoiceId = $enrollment['invoice_id'];

        // Le commercial ne peut pas valider sa propre facture.
        $this->postJson("/api/invoices/{$invoiceId}/validate")->assertStatus(403);

        // Le commercial joint sa preuve de paiement, puis le caissier l'accepte :
        // la facture est validée automatiquement et l'avance déclarée appliquée.
        $this->postJson("/api/invoices/{$invoiceId}/payment-proof", [
            'file' => UploadedFile::fake()->image('recu.jpg'),
            'payment_method' => 'momo',
        ])->assertCreated();

        $proofId = PaymentProof::where('invoice_id', $invoiceId)->first()->id;

        $this->userWithRole('caissier');

        $this->postJson("/api/payment-proofs/{$proofId}/approve")
            ->assertOk()
            ->json();

        $invoice = Invoice::find($invoiceId);
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice->validation_status);
        // L'avance déclarée a été appliquée automatiquement à la validation.
        $this->assertSame(10000.0, (float) $invoice->amount_paid);
    }

    public function test_cashier_enrollment_creates_directly_validated_invoice(): void
    {
        $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'amount_paid' => 50000,
        ])->assertCreated()->json();

        $invoice = Invoice::find($enrollment['invoice_id']);

        $this->assertNotNull($invoice);
        // Guichet : pas de circuit de validation, la facture entre directement en comptabilité.
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice->validation_status);
        $this->assertSame(50000.0, (float) $invoice->amount_paid);
        $this->assertNull($invoice->declared_advance);
    }

    public function test_cashier_can_create_sale_invoice(): void
    {
        $this->userWithRole('caissier');
        $client = $this->createClient();

        $invoice = $this->postJson('/api/invoices', [
            'client_id' => $client->id,
            'items' => [
                ['label' => 'Vente guichet', 'unit_price' => 12000, 'quantity' => 1],
            ],
            'amount_paid' => 12000,
            'payment_type' => 'cash',
        ])->assertStatus(201)->json();

        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice['validation_status']);
    }

    public function test_seller_field_falls_back_to_authenticated_commercial(): void
    {
        $commercial = $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        // Aucun vendeur transmis : c'est le commercial connecté qui est crédité de la vente.
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
        ])->assertCreated()->json();

        $this->assertNotNull($enrollment['seller']);
        $this->assertSame($commercial->id, $enrollment['seller']['id']);
    }

    public function test_cashier_without_explicit_seller_becomes_invoice_seller(): void
    {
        $cashier = $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
        ])->assertCreated()->json();

        $this->assertNotNull($enrollment['seller']);
        $this->assertSame($cashier->id, $enrollment['seller']['id']);
    }

    public function test_commercial_can_upload_payment_proof_on_pending_invoice(): void
    {
        Storage::fake('public');

        $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
        ])->assertCreated()->json();

        $invoiceId = $enrollment['invoice_id'];

        $response = $this->postJson("/api/invoices/{$invoiceId}/payment-proof", [
            'file' => UploadedFile::fake()->image('recut-momo.jpg'),
            'payment_method' => 'momo',
            'phone_number_used' => '690000000',
            'reference' => 'REF-123456',
        ])->assertCreated()->json();

        $this->assertSame(PaymentProof::STATUS_PENDING, $response['payment_proof']['status']);
        $this->assertSame('momo', $response['payment_proof']['payment_method']);

        Storage::disk('public')->assertExists($response['payment_proof']['file_path']);

        // La facture reste en attente : c'est le caissier qui décide après examen.
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'validation_status' => Invoice::VALIDATION_PENDING,
        ]);
    }

    public function test_cashier_accepting_staff_proof_validates_invoice_and_applies_advance(): void
    {
        Storage::fake('public');

        $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        // Inscription avec avance déclarée de 10 000.
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'amount_paid' => 10000,
        ])->assertCreated()->json();

        $invoiceId = $enrollment['invoice_id'];

        $this->postJson("/api/invoices/{$invoiceId}/payment-proof", [
            'file' => UploadedFile::fake()->image('preuve.jpg'),
            'payment_method' => 'orange_money',
        ])->assertCreated();

        $this->userWithRole('caissier');

        $proofId = $this->getJson('/api/payment-proofs?status=pending')
            ->assertOk()
            ->json('data.0.id');

        $response = $this->postJson("/api/payment-proofs/{$proofId}/approve")
            ->assertOk()
            ->json();

        $this->assertSame(Invoice::VALIDATION_VALIDATED, $response['invoice']['validation_status']);
        // L'avance déclarée est appliquée à la validation via la preuve acceptée.
        $this->assertSame(10000.0, (float) $response['invoice']['amount_paid']);
    }

    public function test_cashier_enrollment_payment_is_recorded_as_a_real_payment(): void
    {
        $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'amount_paid' => 10000,
            'payment_type' => 'cash',
        ])->assertCreated()->json();

        // Régression : amount_paid était écrit directement, sans ligne de paiement
        // (absent du bilan « Total encaissé », de la trésorerie et de la comptabilité).
        $this->assertDatabaseHas('invoices', ['id' => $enrollment['invoice_id'], 'amount_paid' => 10000]);
        $this->assertDatabaseHas('invoice_payments', ['invoice_id' => $enrollment['invoice_id'], 'amount' => 10000]);
        $this->assertSame(1, InvoicePayment::where('invoice_id', $enrollment['invoice_id'])->count());
    }

    public function test_repair_command_records_missing_enrollment_payments(): void
    {
        $this->userWithRole('caissier');
        $course = $this->createCourse();
        $client = $this->createClient();
        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
        ])->assertCreated()->json();

        // État d'avant le correctif : montant payé sans ligne de paiement.
        Invoice::whereKey($enrollment['invoice_id'])->update(['amount_paid' => 10000]);

        $this->artisan('invoices:repair-enrollment-payments')->assertSuccessful();
        $this->assertDatabaseMissing('invoice_payments', ['invoice_id' => $enrollment['invoice_id']]);

        $this->artisan('invoices:repair-enrollment-payments', ['--apply' => true])->assertSuccessful();
        $this->assertDatabaseHas('invoice_payments', ['invoice_id' => $enrollment['invoice_id'], 'amount' => 10000]);
        $this->assertDatabaseHas('invoices', ['id' => $enrollment['invoice_id'], 'amount_paid' => 10000]);

        // Relancer ne crée pas de doublon.
        $this->artisan('invoices:repair-enrollment-payments', ['--apply' => true])->assertSuccessful();
        $this->assertSame(1, InvoicePayment::where('invoice_id', $enrollment['invoice_id'])->count());
    }

    public function test_commercial_cannot_upload_proof_on_validated_invoice(): void
    {
        Storage::fake('public');

        $this->createCommercialUser();
        $course = $this->createCourse();
        $client = $this->createClient();

        $enrollment = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
        ])->assertCreated()->json();

        $invoiceId = $enrollment['invoice_id'];

        // Le commercial soumet sa preuve, le caissier l'accepte → facture validée.
        $this->postJson("/api/invoices/{$invoiceId}/payment-proof", [
            'file' => UploadedFile::fake()->image('preuve.jpg'),
            'payment_method' => 'momo',
        ])->assertCreated();

        $proofId = PaymentProof::where('invoice_id', $invoiceId)->first()->id;

        $this->userWithRole('caissier');
        $this->postJson("/api/payment-proofs/{$proofId}/approve")->assertOk();

        $this->createCommercialUser();

        $this->postJson("/api/invoices/{$invoiceId}/payment-proof", [
            'file' => UploadedFile::fake()->image('preuve.jpg'),
            'payment_method' => 'momo',
        ])->assertStatus(422);
    }
}
