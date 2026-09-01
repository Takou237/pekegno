<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Course;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase8OrderProofWorkflowTest extends TestCase
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
            CitySeeder::class,
        ]);
    }

    private function actingAsRole(string $roleName): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $roleName)->value('id'),
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

    public function test_full_workflow_submit_validate_with_proof(): void
    {
        // --- Setup : commercial + cours + service formation + client ---
        $commercialUser = $this->actingAsRole('commercial');
        $commercial = Commercial::factory()->create(['user_id' => $commercialUser->id]);
        $course = Course::factory()->create(['price' => 25000]);
        $formationService = Service::factory()->create([
            'type' => 'formation',
            'course_id' => $course->id,
            'price' => 25000,
        ]);
        $caissierUser = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        $client = $this->createClient();

        // --- 1. Le commercial crée la commande (avec une formation) ---
        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $client->id,
            'commercial_id' => $commercial->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $formationService->id, 'quantity' => 1, 'unit_price' => 25000],
                ['line_type' => 'manual', 'label' => 'Module complémentaire', 'unit_price' => 5000, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->assertSame('draft', $order['status']);
        $this->assertEquals(30000, $order['total_amount']);

        // --- 2. Le commercial soumet la commande avec sa preuve ---
        $submitted = $this->postJson("/api/orders/{$order['id']}/submit", [
            'proof_path' => 'proofs/test-preuve.png',
            'proof_url' => '/storage/proofs/test-preuve.png',
        ])->assertOk()->json();

        $this->assertSame('pending_validation', $submitted['status']);
        $this->assertEquals('proofs/test-preuve.png', $submitted['proof_path']);

        // La caissière est notifiée (permission orders.valider).
        $this->assertDatabaseHas('notifications', [
            'user_id' => $caissierUser->id,
            'type' => 'order_due',
        ]);

        // --- 3. La caissière valide avec encaissement ---
        Sanctum::actingAs($caissierUser);
        $invoice = $this->postJson("/api/orders/{$order['id']}/validate", [
            'payment_method' => 'mobile_money',
            'note' => 'Preuve vérifiée',
        ])->assertStatus(201)->json();

        $this->assertCount(2, $invoice['items']);
        $this->assertEquals(30000, $invoice['total_amount']);
        $this->assertSame('paid', $invoice['status']);

        // La commande est terminée et liée à la facture.
        $this->assertDatabaseHas('orders', [
            'id' => $order['id'],
            'status' => 'completed',
            'invoice_id' => $invoice['id'],
            'validated_by' => $caissierUser->id,
        ]);

        // Paiement enregistré sur la facture.
        $this->assertDatabaseHas('invoice_payments', [
            'invoice_id' => $invoice['id'],
            'amount' => 30000,
            'payment_method' => 'mobile_money',
        ]);

        // L'apprenant est inscrit à la formation.
        $this->assertDatabaseHas('formation_enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $client->id,
            'invoice_id' => $invoice['id'],
            'status' => 'enrolled',
            'seller_user_id' => $commercialUser->id,
        ]);

        // Le commercial vendeur est notifié de la validation.
        $this->assertDatabaseHas('notifications', [
            'user_id' => $commercialUser->id,
            'type' => 'order_validated',
        ]);
    }

    public function test_validate_requires_pending_validation_status(): void
    {
        $this->actingAsRole('commercial');
        $course = Course::factory()->create();
        $formationService = Service::factory()->create([
            'type' => 'formation',
            'course_id' => $course->id,
            'price' => 15000,
        ]);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $formationService->id, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $caissierUser = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        Sanctum::actingAs($caissierUser);

        // Statut draft => validation refusée.
        $this->postJson("/api/orders/{$order['id']}/validate", ['payment_method' => 'cash'])
            ->assertStatus(422);

        // Après soumission, la validation passe.
        Sanctum::actingAs($this->actingAsRole('commercial'));
        $this->postJson("/api/orders/{$order['id']}/submit", ['proof_url' => '/storage/proofs/x.png'])->assertOk();

        Sanctum::actingAs($caissierUser);
        $this->postJson("/api/orders/{$order['id']}/validate", ['payment_method' => 'cash'])
            ->assertStatus(201);

        // La double validation est refusée.
        $this->postJson("/api/orders/{$order['id']}/validate", ['payment_method' => 'cash'])
            ->assertStatus(422);
    }

    public function test_decline_returns_order_to_draft_and_notifies_seller(): void
    {
        $commercialUser = $this->actingAsRole('commercial');
        $commercial = Commercial::factory()->create(['user_id' => $commercialUser->id]);
        $course = Course::factory()->create();
        $formationService = Service::factory()->create([
            'type' => 'formation',
            'course_id' => $course->id,
            'price' => 15000,
        ]);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'commercial_id' => $commercial->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $formationService->id, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->postJson("/api/orders/{$order['id']}/submit", ['proof_url' => '/storage/proofs/y.png'])->assertOk();

        $caissierUser = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
        ]);
        Sanctum::actingAs($caissierUser);

        $declined = $this->postJson("/api/orders/{$order['id']}/decline", [
            'note' => 'Preuve illisible',
        ])->assertOk()->json();

        $this->assertSame('draft', $declined['status']);
        $this->assertEquals('Preuve illisible', $declined['validation_note']);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $commercialUser->id,
            'type' => 'order_declined',
        ]);
    }

    public function test_only_validators_can_validate_orders(): void
    {
        $this->actingAsRole('commercial');
        $course = Course::factory()->create();
        $formationService = Service::factory()->create([
            'type' => 'formation',
            'course_id' => $course->id,
            'price' => 15000,
        ]);

        $order = $this->postJson('/api/orders', [
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $this->createClient()->id,
            'lines' => [
                ['line_type' => 'catalog', 'service_id' => $formationService->id, 'quantity' => 1],
            ],
        ])->assertStatus(201)->json();

        $this->postJson("/api/orders/{$order['id']}/submit", ['proof_url' => '/storage/proofs/z.png'])->assertOk();

        // Le commercial ne peut pas valider (permission refusée).
        $this->postJson("/api/orders/{$order['id']}/validate", ['payment_method' => 'cash'])
            ->assertForbidden();
    }

    public function test_upload_proof_endpoint_stores_file(): void
    {
        Storage::fake('public');
        $this->actingAsRole('commercial');

        $this->postJson('/api/uploads/proof', [
            'file' => UploadedFile::fake()->create('preuve.pdf', 100, 'application/pdf'),
        ])->assertStatus(201)
            ->assertJsonStructure(['path', 'url']);
    }
}