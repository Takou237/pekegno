<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Services\OrderInvoicingService;
use App\Services\OrderNumberGenerator;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Workflow de validation des factures par le staff — Phase 3 du plan.
 * Permissions clés : invoices.valider (caissier, direction-generale).
 */
class Phase3ValidationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            OrganizationSeeder::class,
        ]);
    }

    private function staffWithRole(string $role): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function pendingInvoice(): Invoice
    {
        $client = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        $service = Service::factory()->create(['price' => 10000]);

        $order = Order::create([
            'number' => app(OrderNumberGenerator::class)->next(),
            'agency_id' => Agency::factory()->create()->id,
            'client_id' => $client->id,
            'status' => 'confirmed',
            'channel' => 'client_self',
            'order_date' => now()->toDateString(),
            'subtotal' => 20000,
            'discount' => 0,
            'vat_rate' => 0,
            'total_amount' => 20000,
        ]);
        $order->lines()->create([
            'line_type' => 'catalog',
            'service_id' => $service->id,
            'label' => $service->name,
            'unit_price' => 10000,
            'quantity' => 2,
            'line_total' => 20000,
        ]);

        return app(OrderInvoicingService::class)->invoiceFromOrder($order, $client->id);
    }

    public function test_cashier_filters_pending_invoices_and_validates_them(): void
    {
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->getJson('/api/invoices?validation_status=pending')
            ->assertOk()
            ->assertJsonPath('invoices.total', 1);

        $validated = $this->postJson("/api/invoices/{$invoice->id}/validate")
            ->assertOk()
            ->json();

        $this->assertSame(Invoice::VALIDATION_VALIDATED, $validated['validation_status']);

        $invoice->refresh();
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $invoice->validation_status);
        $this->assertNotNull($invoice->validated_by);
        $this->assertNotNull($invoice->validated_at);

        $this->getJson('/api/invoices?validation_status=pending')->assertJsonPath('invoices.total', 0);
        $this->getJson('/api/invoices?validation_status=validated')->assertJsonPath('invoices.total', 1);
    }

    public function test_reject_requires_a_reason_and_records_it(): void
    {
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/reject", [])
            ->assertStatus(422);

        $rejected = $this->postJson("/api/invoices/{$invoice->id}/reject", [
            'rejection_reason' => 'Preuve de paiement illisible',
        ])->assertOk()->json();

        $this->assertSame(Invoice::VALIDATION_REJECTED, $rejected['validation_status']);
        $this->assertSame('Preuve de paiement illisible', $invoice->fresh()->rejection_reason);
        $this->assertNotNull($invoice->fresh()->validated_at);
    }

    public function test_validation_only_accepts_pending_invoices(): void
    {
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertOk();

        // Déjà validée.
        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertStatus(422);

        // Rejetée : ne peut plus être validée.
        $second = $this->pendingInvoice();
        $this->postJson("/api/invoices/{$second->id}/reject", ['rejection_reason' => 'Doublon'])->assertOk();
        $this->postJson("/api/invoices/{$second->id}/validate")->assertStatus(422);
    }

    public function test_pending_invoice_cannot_be_paid_until_validated(): void
    {
        $invoice = $this->pendingInvoice();

        $this->staffWithRole('comptable');

        $this->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => 5000,
            'payment_method' => 'om',
        ])->assertStatus(422);

        $this->staffWithRole('caissier');
        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertOk();

        $this->staffWithRole('comptable');
        $paid = $this->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => 20000,
            'payment_method' => 'om',
        ])->assertOk()->json();

        $this->assertSame('paid', $paid['status']);
    }

    public function test_staff_without_validation_permission_cannot_validate_or_reject(): void
    {
        $this->staffWithRole('commercial');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertForbidden();
        $this->postJson("/api/invoices/{$invoice->id}/reject", ['rejection_reason' => 'Non'])->assertForbidden();
    }

    public function test_director_can_validate_pending_invoice(): void
    {
        $this->staffWithRole('direction-generale');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);
    }
}