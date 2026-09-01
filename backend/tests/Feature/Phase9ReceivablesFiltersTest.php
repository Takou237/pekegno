<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase9ReceivablesFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function admin(): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
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

    private function createCourse(array $overrides = []): array
    {
        return $this->postJson('/api/courses', array_merge([
            'name' => 'Cours filtré',
            'mode' => 'in_person',
            'price' => 50000,
            'duration_hours' => 20,
            'is_active' => true,
        ], $overrides))
            ->assertStatus(201)
            ->json();
    }

    private function createSession(string $courseId, array $overrides = []): array
    {
        return $this->postJson('/api/training-sessions', array_merge([
            'course_id' => $courseId,
            'start_at' => now()->addDays(7)->toISOString(),
            'end_at' => now()->addDays(7)->addHours(4)->toISOString(),
        ], $overrides))
            ->assertStatus(201)
            ->json();
    }

    private function enroll(string $courseId, string $clientId): array
    {
        return $this->postJson('/api/formation-enrollments', [
            'course_id' => $courseId,
            'learner_user_id' => $clientId,
        ])->assertStatus(201)
            ->json();
    }

    public function test_receivables_filter_by_course(): void
    {
        $this->admin();
        $courseA = $this->createCourse(['name' => 'Formation A']);
        $courseB = $this->createCourse(['name' => 'Formation B']);

        $enrollmentA = $this->enroll($courseA['id'], $this->createClient()->id);
        $enrollmentB = $this->enroll($courseB['id'], $this->createClient()->id);

        $this->assertNotNull($enrollmentA['invoice_id']);
        $this->assertNotNull($enrollmentB['invoice_id']);

        $this->getJson('/api/invoices?status=unpaid,partial&from_enrollments=1&course_id='.$courseA['id'])
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.id', $enrollmentA['invoice_id'])
            ->assertJsonPath('totals.outstanding', 50000);

        $this->getJson('/api/invoices?status=unpaid,partial&from_enrollments=1&course_id='.$courseB['id'])
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.id', $enrollmentB['invoice_id']);
    }

    public function test_receivables_filter_by_session(): void
    {
        $this->admin();
        $courseA = $this->createCourse(['name' => 'Formation A']);
        $courseB = $this->createCourse(['name' => 'Formation B']);

        $sessionA = $this->createSession($courseA['id']);
        $sessionB = $this->createSession($courseB['id']);

        $enrollmentA = $this->enroll($courseA['id'], $this->createClient()->id);
        $enrollmentB = $this->enroll($courseB['id'], $this->createClient()->id);

        $this->assertDatabaseHas('session_participants', [
            'training_session_id' => $sessionA['id'],
            'formation_enrollment_id' => $enrollmentA['id'],
        ]);

        $this->getJson('/api/invoices?status=unpaid,partial&from_enrollments=1&session_id='.$sessionA['id'])
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.id', $enrollmentA['invoice_id']);

        $this->getJson('/api/invoices?status=unpaid,partial&from_enrollments=1&session_id='.$sessionB['id'])
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data')
            ->assertJsonPath('invoices.data.0.id', $enrollmentB['invoice_id']);
    }

    public function test_receivables_filter_by_period(): void
    {
        $this->admin();
        $course = $this->createCourse();
        $enrollment = $this->enroll($course['id'], $this->createClient()->id);

        Invoice::where('id', $enrollment['invoice_id'])->update(['invoice_date' => now()->subMonth()]);

        $this->getJson('/api/invoices?status=unpaid,partial&from_enrollments=1&from='.now()->subMonth()->startOfMonth()->toDateString().'&to='.now()->subMonth()->endOfMonth()->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'invoices.data');

        $this->getJson('/api/invoices?status=unpaid,partial&from_enrollments=1&from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
            ->assertOk()
            ->assertJsonCount(0, 'invoices.data');
    }
}