<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ClientCategorySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Phase4ClientPortalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            ClientCategorySeeder::class,
        ]);
    }

    private function registerClient(array $attributes = []): array
    {
        return $this->postJson('/api/client/register', array_merge([
            'first_name' => 'Claire',
            'last_name' => 'Client',
            'email' => 'claire@example.com',
            'phone' => '+237690000000',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ], $attributes))->assertStatus(201)->json();
    }

    private function loginClient(string $email = 'claire@example.com'): array
    {
        return $this->postJson('/api/client/login', [
            'email' => $email,
            'password' => 'password123',
        ])->assertOk()->json();
    }

    private function authClient(): string
    {
        $this->registerClient();
        return $this->loginClient()['token'];
    }

    private function clientUser(): User
    {
        return User::where('email', 'claire@example.com')->firstOrFail();
    }

    private function orderPayload(): array
    {
        $service = Service::factory()->create(['price' => 10000]);
        return [
            'agency_id' => Agency::factory()->create()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $service->id, 'quantity' => 2],
                ['line_type' => 'manual', 'label' => 'Accompagnement', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ];
    }

    public function test_client_can_create_order_as_client_self(): void
    {
        $token = $this->authClient();

        $order = $this->withToken($token)
            ->postJson('/api/client/orders', $this->orderPayload())
            ->assertStatus(201)
            ->json();

        $this->assertSame('confirmed', $order['status']);
        $this->assertSame('client_self', $order['channel']);
        $this->assertEquals(35000, $order['total_amount']);
        $this->assertSame($this->clientUser()->id, $order['client_id']);
        $this->assertCount(2, $order['lines']);
    }

    public function test_client_lists_only_own_orders(): void
    {
        $token = $this->authClient();
        $order = $this->withToken($token)->postJson('/api/client/orders', $this->orderPayload())->assertStatus(201)->json();

        $this->getJson('/api/client/orders')->assertOk()->assertJsonCount(1, 'data');

        $this->withToken($token)->getJson("/api/client/orders/{$order['id']}")->assertOk();
        $this->assertNotEmpty($order['id']);
    }

    public function test_checkout_creates_order_and_pending_invoice(): void
    {
        $token = $this->authClient();

        $result = $this->withToken($token)
            ->postJson('/api/client/checkout', $this->orderPayload())
            ->assertStatus(201)
            ->json();

        $order = $result['order'];
        $invoice = $result['invoice'];
        $this->assertSame('completed', $order['status']);
        $this->assertSame('client_self', $order['channel']);
        $this->assertEquals(35000, $invoice['total_amount']);
        $this->assertSame('unpaid', $invoice['status']);
        $this->assertSame(Invoice::VALIDATION_PENDING, $invoice['validation_status']);
        $this->assertSame('online', $invoice['source']);

        $this->assertDatabaseHas('orders', [
            'id' => $order['id'],
            'status' => 'completed',
            'invoice_id' => $invoice['id'],
        ]);
    }

    public function test_client_lists_and_reads_own_invoices(): void
    {
        $token = $this->authClient();
        $invoice = $this->withToken($token)->postJson('/api/client/checkout', $this->orderPayload())->assertStatus(201)->json('invoice');

        $this->getJson('/api/client/invoices')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/client/invoices?validation_status=pending')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/client/invoices?validation_status=validated')->assertOk()->assertJsonCount(0, 'data');

        $detail = $this->withToken($token)->getJson("/api/client/invoices/{$invoice['id']}")->assertOk()->json();
        $this->assertCount(2, $detail['items']);
        $this->assertSame('unpaid', $detail['status']);
    }

    public function test_client_upload_payment_proof(): void
    {
        Storage::fake('public');
        $token = $this->authClient();
        $invoice = $this->withToken($token)->postJson('/api/client/checkout', $this->orderPayload())->assertStatus(201)->json('invoice');

        $response = $this->withToken($token)
            ->postJson("/api/client/invoices/{$invoice['id']}/payment-proof", [
                'file' => UploadedFile::fake()->image('reçu.png'),
                'payment_method' => 'Mobile Money',
                'phone_number_used' => '+237690000000',
                'reference' => 'MOMO-12345',
            ])
            ->assertStatus(201)
            ->json();

        $proof = $response['payment_proof'];
        $this->assertSame('pending', $proof['status']);
        $this->assertSame('Mobile Money', $proof['payment_method']);

        $this->assertDatabaseHas('payment_proofs', [
            'id' => $proof['id'],
            'invoice_id' => $invoice['id'],
            'submitted_by' => $this->clientUser()->id,
            'status' => 'pending',
        ]);

        $this->assertNotNull(PaymentProof::find($proof['id'])->file_path);
    }

    public function test_client_cannot_access_another_clients_resources(): void
    {
        $token = $this->authClient();
        $order = $this->withToken($token)->postJson('/api/client/orders', $this->orderPayload())->assertStatus(201)->json();

        $paul = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
            'email' => 'paul@example.com',
        ]);
        $otherService = Service::factory()->create(['price' => 5000]);
        $paulOrder = \App\Models\Order::create([
            'number' => app(\App\Services\OrderNumberGenerator::class)->next(),
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $paul->id,
            'status' => 'confirmed',
            'channel' => 'client_self',
            'order_date' => now()->toDateString(),
            'subtotal' => 5000,
            'discount' => 0,
            'vat_rate' => 0,
            'total_amount' => 5000,
        ]);
        $paulOrder->lines()->create([
            'line_type' => 'catalog',
            'service_id' => $otherService->id,
            'label' => $otherService->name,
            'unit_price' => 5000,
            'quantity' => 1,
            'line_total' => 5000,
        ]);
        $paulInvoice = app(\App\Services\OrderInvoicingService::class)->invoiceFromOrder($paulOrder, $paul->id);

        $this->withToken($token)->getJson("/api/client/orders/{$paulOrder->id}")->assertStatus(404);
        $this->withToken($token)->getJson("/api/client/invoices/{$paulInvoice->id}")->assertStatus(404);

        $this->withToken($token)->getJson('/api/client/orders')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_client_enrollments_and_learner_profile(): void
    {
        $token = $this->authClient();
        $user = $this->clientUser();

        $course = \App\Models\Course::factory()->create(['name' => 'Formation Excel', 'price' => 50000]);
        $module = \App\Models\CourseModule::create([
            'course_id' => $course->id,
            'name' => 'Module 1',
            'order_index' => 1,
        ]);
        $session = \App\Models\TrainingSession::factory()->create(['course_id' => $course->id]);

        \App\Models\FormationEnrollment::create([
            'course_id' => $course->id,
            'learner_user_id' => $user->id,
            'enrolled_at' => now(),
            'status' => 'active',
        ]);

        \App\Models\Attendance::create([
            'training_session_id' => $session->id,
            'learner_user_id' => $user->id,
            'course_module_id' => $module->id,
            'status' => \App\Models\Attendance::STATUS_PRESENT,
            'recorded_at' => now(),
        ]);

        $enrollments = $this->withToken($token)->getJson('/api/client/enrollments')->assertOk()->json();
        $this->assertCount(1, $enrollments['data']);
        $this->assertSame('Formation Excel', $enrollments['data'][0]['course']['name']);

        $profile = $this->withToken($token)->getJson('/api/client/learner-profile')->assertOk()->json();
        $this->assertSame($user->email, $profile['profile']['email']);
        $this->assertCount(1, $profile['courses']);
        $this->assertSame(1, $profile['courses'][0]['modules'][0]['presences']['present']);
        $this->assertSame(0, $profile['courses'][0]['modules'][0]['presences']['absent']);
        $this->assertSame(1, $profile['courses'][0]['modules'][0]['presences']['recorded']);

        $attendances = $this->withToken($token)->getJson('/api/client/attendances')->assertOk()->json();
        $this->assertCount(1, $attendances['data']);
        $this->assertSame('present', $attendances['data'][0]['status']);
    }

    public function test_client_observations_visible_only(): void
    {
        $token = $this->authClient();
        $user = $this->clientUser();

        \App\Models\LearnerObservation::create([
            'learner_user_id' => $user->id,
            'author_user_id' => $user->id,
            'visible_to_client' => true,
            'content' => 'Observation visible',
        ]);
        \App\Models\LearnerObservation::create([
            'learner_user_id' => $user->id,
            'author_user_id' => $user->id,
            'visible_to_client' => false,
            'content' => 'Observation interne',
        ]);

        $observations = $this->withToken($token)->getJson('/api/client/observations')->assertOk()->json();
        $this->assertCount(1, $observations['data']);
        $this->assertSame('Observation visible', $observations['data'][0]['content']);

        $created = $this->withToken($token)->postJson('/api/client/observations', [
            'content' => 'Ma note personnelle',
        ])->assertStatus(201)->json();

        $this->assertSame($user->id, $created['learner_user_id']);
        $this->assertSame(true, $created['visible_to_client']);
        $this->assertSame('Ma note personnelle', $created['content']);
    }
}
