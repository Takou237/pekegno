<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Lot 7 : verification publique d'un certificat par son numero, sans
 * authentification.
 */
class PublicCertificateVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function certificate(array $attributes = []): Certificate
    {
        $course = Course::factory()->create(['name' => 'Developpement Web']);
        $learner = User::factory()->create([
            'first_name' => 'Awa',
            'last_name' => 'Diop',
            'email' => 'awa.diop@example.test',
        ]);
        $enrollment = FormationEnrollment::create([
            'course_id' => $course->id,
            'learner_user_id' => $learner->id,
            'enrolled_at' => now(),
            'status' => FormationEnrollment::STATUS_COMPLETED,
        ]);

        return Certificate::create(array_merge([
            'enrollment_id' => $enrollment->id,
            'number' => 'CERT-00042',
            'issued_on' => '2026-10-15',
            'mention' => 'Bien',
            'status' => Certificate::STATUS_ISSUED,
        ], $attributes));
    }

    public function test_an_issued_certificate_can_be_verified_without_authentication(): void
    {
        $this->certificate();

        $response = $this->getJson('/api/public/certificates/CERT-00042/verify');

        $response->assertOk()
            ->assertJson([
                'valid' => true,
                'status' => Certificate::STATUS_ISSUED,
                'number' => 'CERT-00042',
                'issued_on' => '2026-10-15',
                'mention' => 'Bien',
                'revoked_reason' => null,
                'learner' => 'Awa Diop',
                'course' => 'Developpement Web',
            ])
            ->assertJsonMissingPath('learner.email');
    }

    public function test_a_revoked_certificate_is_reported_as_invalid_with_its_reason(): void
    {
        $this->certificate([
            'status' => Certificate::STATUS_REVOKED,
            'revoked_reason' => 'Fraude constatee',
        ]);

        $response = $this->getJson('/api/public/certificates/CERT-00042/verify');

        $response->assertOk()->assertJson([
            'valid' => false,
            'status' => Certificate::STATUS_REVOKED,
            'revoked_reason' => 'Fraude constatee',
            'learner' => 'Awa Diop',
        ]);
    }

    public function test_an_unknown_serial_returns_404_and_invalid(): void
    {
        $response = $this->getJson('/api/public/certificates/CERT-99999/verify');

        $response->assertNotFound()->assertJson([
            'valid' => false,
        ]);
    }
}
