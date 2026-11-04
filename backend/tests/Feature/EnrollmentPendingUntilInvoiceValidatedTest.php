<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\SessionParticipant;
use App\Models\TrainingSession;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Une inscription dont la facture attend validation n'inscrit pas l'apprenant :
 * statut « pending », aucune place en session. Elle devient effective à la
 * validation de la facture et est annulée si la facture est annulée / rejetée.
 */
class EnrollmentPendingUntilInvoiceValidatedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function commercial(): User
    {
        $user = $this->user('commercial');
        Commercial::factory()->create(['user_id' => $user->id, 'agency_id' => Agency::factory()->create()->id]);

        return $user;
    }

    private function courseWithSession(): array
    {
        $course = Course::factory()->create(['price' => 50000, 'is_public' => true, 'is_active' => true]);
        $session = TrainingSession::factory()->create([
            'course_id' => $course->id,
            'start_at' => now()->addDays(5),
            'end_at' => now()->addDays(10),
            'max_capacity' => 10,
        ]);

        return [$course, $session];
    }

    /** Preuve insérée directement : l'upload d'image (GD) n'est pas l'objet du test. */
    private function proofFor(Invoice $invoice, User $submitter, string $status): PaymentProof
    {
        return PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $submitter->id,
            'payment_method' => 'momo',
            'amount' => 10000,
            'file_path' => 'payment-proofs/test.jpg',
            'status' => $status,
        ]);
    }

    private function commercialEnrollment(User $commercial, Course $course, TrainingSession $session, array $extra = []): FormationEnrollment
    {
        Sanctum::actingAs($commercial);

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $this->user('client')->id,
            'training_session_id' => $session->id,
            'amount_paid' => 10000,
            ...$extra,
        ])->assertCreated()->json();

        return FormationEnrollment::findOrFail($response['id']);
    }

    private function participants(FormationEnrollment $enrollment)
    {
        return SessionParticipant::where('formation_enrollment_id', $enrollment->id)->get();
    }

    public function test_enrollment_with_pending_invoice_is_not_effective(): void
    {
        [$course, $session] = $this->courseWithSession();
        $enrollment = $this->commercialEnrollment($this->commercial(), $course, $session);

        $this->assertSame(Invoice::VALIDATION_PENDING, $enrollment->invoice->validation_status);
        $this->assertSame(FormationEnrollment::STATUS_PENDING, $enrollment->status);
        $this->assertSame($session->id, $enrollment->requested_session_id);
        $this->assertCount(0, $this->participants($enrollment));

        Sanctum::actingAs($this->user('super-admin'));
        $courses = $this->getJson('/api/courses')->assertOk()->json('data');
        $this->assertSame(0, collect($courses)->firstWhere('id', $course->id)['formation_enrollments_count']);
    }

    public function test_validating_invoice_enrolls_learner_in_requested_session(): void
    {
        [$course, $session] = $this->courseWithSession();
        $commercial = $this->commercial();
        $enrollment = $this->commercialEnrollment($commercial, $course, $session);
        $this->proofFor($enrollment->invoice, $commercial, PaymentProof::STATUS_ACCEPTED);

        Sanctum::actingAs($this->user('super-admin'));
        $this->postJson("/api/invoices/{$enrollment->invoice_id}/validate")->assertOk();

        $enrollment->refresh();
        $this->assertSame(FormationEnrollment::STATUS_ENROLLED, $enrollment->status);
        $this->assertNull($enrollment->requested_session_id);
        $this->assertSame(['enrolled'], $this->participants($enrollment)->pluck('status')->all());
        $this->assertSame($session->id, $this->participants($enrollment)->first()->training_session_id);
    }

    public function test_accepting_payment_proof_enrolls_learner(): void
    {
        [$course, $session] = $this->courseWithSession();
        $commercial = $this->commercial();
        $enrollment = $this->commercialEnrollment($commercial, $course, $session);
        $proof = $this->proofFor($enrollment->invoice, $commercial, PaymentProof::STATUS_PENDING);

        Sanctum::actingAs($this->user('super-admin'));
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();

        $this->assertSame(FormationEnrollment::STATUS_ENROLLED, $enrollment->fresh()->status);
        $this->assertSame(['enrolled'], $this->participants($enrollment)->pluck('status')->all());
    }

    public function test_cancelling_pending_invoice_cancels_enrollment_without_session_spot(): void
    {
        [$course, $session] = $this->courseWithSession();
        $commercial = $this->commercial();
        $enrollment = $this->commercialEnrollment($commercial, $course, $session);

        Sanctum::actingAs($commercial);
        $this->postJson("/api/invoices/{$enrollment->invoice_id}/cancel")->assertOk();

        $this->assertSame(FormationEnrollment::STATUS_CANCELLED, $enrollment->fresh()->status);
        $this->assertCount(0, $this->participants($enrollment));
    }

    public function test_rejecting_payment_proof_cancels_pending_enrollment(): void
    {
        [$course, $session] = $this->courseWithSession();
        $commercial = $this->commercial();
        $enrollment = $this->commercialEnrollment($commercial, $course, $session);
        $proof = $this->proofFor($enrollment->invoice, $commercial, PaymentProof::STATUS_PENDING);

        Sanctum::actingAs($this->user('super-admin'));
        $this->postJson("/api/payment-proofs/{$proof->id}/reject", ['notes' => 'Illisible'])->assertOk();

        $this->assertSame(FormationEnrollment::STATUS_CANCELLED, $enrollment->fresh()->status);
        $this->assertCount(0, $this->participants($enrollment));
    }

    public function test_pending_enrollment_cannot_be_forced_to_enrolled_manually(): void
    {
        [$course, $session] = $this->courseWithSession();
        $enrollment = $this->commercialEnrollment($this->commercial(), $course, $session);

        Sanctum::actingAs($this->user('super-admin'));
        $this->putJson("/api/formation-enrollments/{$enrollment->id}", ['status' => 'enrolled'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(FormationEnrollment::STATUS_PENDING, $enrollment->fresh()->status);
        $this->assertCount(0, $this->participants($enrollment));
    }

    public function test_validator_enrollment_is_effective_immediately(): void
    {
        [$course, $session] = $this->courseWithSession();
        Sanctum::actingAs($this->user('caissier'));

        $response = $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $this->user('client')->id,
            'training_session_id' => $session->id,
            'amount_paid' => 50000,
        ])->assertCreated()->json();

        $enrollment = FormationEnrollment::findOrFail($response['id']);
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $enrollment->invoice->validation_status);
        $this->assertSame(FormationEnrollment::STATUS_ENROLLED, $enrollment->status);
        $this->assertSame(['enrolled'], $this->participants($enrollment)->pluck('status')->all());
    }

    public function test_client_online_enrollment_waits_for_payment_validation(): void
    {
        [$course, $session] = $this->courseWithSession();
        $client = $this->user('client');
        // L'espace client exige un jeton « client-token » (middleware portal:client).
        $this->withToken($client->createToken('client-token')->plainTextToken);

        $response = $this->postJson('/api/client/enrollments', [
            'course_id' => $course->id,
            'training_session_id' => $session->id,
        ])->assertCreated()->json();

        $enrollment = FormationEnrollment::findOrFail($response['id']);
        $this->assertSame(FormationEnrollment::STATUS_PENDING, $enrollment->status);
        $this->assertCount(0, $this->participants($enrollment));

        // Une seconde tentative est refusée tant que la première est en attente.
        $this->postJson('/api/client/enrollments', ['course_id' => $course->id])->assertStatus(409);

        $proof = $this->proofFor($enrollment->invoice, $client, PaymentProof::STATUS_PENDING);
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($this->user('super-admin'));
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();

        $this->assertSame(FormationEnrollment::STATUS_ENROLLED, $enrollment->fresh()->status);
        $this->assertSame([$session->id], $this->participants($enrollment)->pluck('training_session_id')->all());
    }
}
