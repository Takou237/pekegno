<?php

namespace Tests\Feature;

use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Services\CommissionService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase2Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createCommercial(array $attributes = []): array
    {
        return $this->postJson('/api/commercials', array_merge([
            'first_name' => 'Jean',
            'last_name' => 'Vendeur',
            'email' => fake()->unique()->safeEmail(),
            'commission_type' => 'percent',
            'commission_value' => 10,
        ], $attributes))->assertStatus(201)->json();
    }

    private function createInvoice(array $attributes = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ], $attributes))->assertStatus(201)->json();
    }

    private function pay(string $invoiceId, float $amount, string $method = 'cash'): TestResponse
    {
        return $this->postJson("/api/invoices/{$invoiceId}/payments", [
            'amount' => $amount,
            'payment_method' => $method,
        ]);
    }

    public function test_invoice_payment_limited_to_three_instalments(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->createInvoice();

        $this->pay($invoice['id'], 5000)->assertOk();
        $this->pay($invoice['id'], 5000)->assertOk();
        $this->pay($invoice['id'], 5000)->assertOk()->assertJsonPath('status', 'paid');

        $this->pay($invoice['id'], 100)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Paiement en tranches limité à 3 (3 versements maximum).');

        $this->assertDatabaseCount('invoice_payments', 3);
    }

    public function test_advance_counts_as_first_instalment(): void
    {
        $this->actingAsAdmin();

        $invoice = $this->createInvoice(['advance' => 10000, 'payment_type' => 'cash']);

        $invoice['invoice_payments'] ?? null;
        $this->assertDatabaseCount('invoice_payments', 1);

        $this->pay($invoice['id'], 2500)->assertOk();
        $this->pay($invoice['id'], 2500)->assertOk()->assertJsonPath('status', 'paid');

        $this->pay($invoice['id'], 100)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Paiement en tranches limité à 3 (3 versements maximum).');

        $this->assertDatabaseCount('invoice_payments', 3);
    }

    public function test_commission_percent_is_awarded_per_instalment(): void
    {
        $this->actingAsAdmin();

        $commercial = $this->createCommercial(['commission_value' => 10]);
        $invoice = $this->createInvoice([
            'commercial_id' => $commercial['id'],
            'items' => [
                ['label' => 'Formation', 'unit_price' => 15000, 'quantity' => 1],
            ],
        ]);

        $this->pay($invoice['id'], 5000)->assertOk();

        $this->assertDatabaseHas('commission_payments', [
            'invoice_id' => $invoice['id'],
            'commercial_id' => $commercial['id'],
            'amount' => 500.00,
            'base_amount' => 5000.00,
            'rule' => 'percent',
            'rate' => 10.00,
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'commission_amount' => 500]);

        $this->pay($invoice['id'], 10000)->assertOk();

        $this->assertDatabaseCount('commission_payments', 2);
        $this->assertDatabaseHas('commission_payments', [
            'invoice_id' => $invoice['id'],
            'amount' => 1000.00,
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'commission_amount' => 1500]);
    }

    public function test_commission_fixed_is_prorated_on_instalment(): void
    {
        $this->actingAsAdmin();

        $commercial = $this->createCommercial([
            'commission_type' => 'fixed',
            'commission_value' => 1500,
        ]);
        $invoice = $this->createInvoice(['commercial_id' => $commercial['id']]);

        $this->pay($invoice['id'], 5000)->assertOk();

        $this->assertDatabaseHas('commission_payments', [
            'invoice_id' => $invoice['id'],
            'amount' => 500.00,
            'base_amount' => 5000.00,
            'rule' => 'fixed',
            'rate' => 1500.00,
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'commission_amount' => 500]);
    }

    public function test_service_bonus_fixed_overrides_commercial_percentage(): void
    {
        $this->actingAsAdmin();

        $service = Service::factory()->create(['price' => 15000, 'bonus_fixed' => 300]);
        $commercial = $this->createCommercial(['commission_value' => 10]);
        $invoice = $this->createInvoice([
            'commercial_id' => $commercial['id'],
            'items' => [
                ['service_id' => $service->id, 'unit_price' => 15000, 'quantity' => 1],
            ],
        ]);

        $this->pay($invoice['id'], 5000)->assertOk();

        $this->assertDatabaseHas('commission_payments', [
            'invoice_id' => $invoice['id'],
            'service_id' => $service->id,
            'amount' => 100.00, // 300 × 5000/15000 — la prime fixe prime sur 10% × 5000 = 500
            'base_amount' => 5000.00,
            'rule' => 'service_fixed',
            'rate' => 300.00,
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'commission_amount' => 100]);
    }

    public function test_multiline_commission_shares_payment_by_line_weight(): void
    {
        $this->actingAsAdmin();

        $service = Service::factory()->create(['price' => 10000, 'bonus_fixed' => 300]);
        $commercial = $this->createCommercial(['commission_value' => 10]);
        $invoice = $this->createInvoice([
            'commercial_id' => $commercial['id'],
            'items' => [
                ['service_id' => $service->id, 'unit_price' => 10000, 'quantity' => 1],
                ['label' => 'Conseil', 'unit_price' => 5000, 'quantity' => 1],
            ],
        ]);

        $this->pay($invoice['id'], 15000)->assertOk();

        $this->assertDatabaseHas('commission_payments', [
            'invoice_id' => $invoice['id'],
            'service_id' => $service->id,
            'amount' => 300.00, // prime fixe pleine (paiement intégral)
            'rule' => 'service_fixed',
        ]);
        $this->assertDatabaseHas('commission_payments', [
            'invoice_id' => $invoice['id'],
            'amount' => 500.00, // 10% × part de la seconde ligne (5000)
            'rule' => 'percent',
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'commission_amount' => 800]);
        $this->assertDatabaseCount('commission_payments', 2);
    }

    public function test_points_awarded_only_when_invoice_is_sold_out(): void
    {
        $this->actingAsAdmin();

        $commercial = $this->createCommercial();
        $invoice = $this->createInvoice(['commercial_id' => $commercial['id']]);

        $this->pay($invoice['id'], 5000)->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice['id'],
            'points_awarded' => 0,
        ]);
        $this->assertDatabaseMissing('commercial_points', ['commercial_id' => $commercial['id']]);

        $this->pay($invoice['id'], 10000)->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice['id'],
            'points_awarded' => 3,
        ]);
        $this->assertDatabaseHas('commercial_points', [
            'commercial_id' => $commercial['id'],
            'points' => 3,
            'reason' => 'sale',
        ]);
    }

    public function test_commission_recording_is_idempotent_per_payment(): void
    {
        $this->actingAsAdmin();

        $commercial = $this->createCommercial();
        $invoice = $this->createInvoice(['commercial_id' => $commercial['id']]);

        $this->pay($invoice['id'], 5000)->assertOk();

        $fresh = $invoice;
        $payment = InvoicePayment::where('invoice_id', $invoice['id'])->firstOrFail();
        $service = app(CommissionService::class);

        $service->recordForPayment($payment->invoice->refresh(), $payment, $this->actingAsAdmin()->id);
        $service->recordForPayment($payment->invoice->refresh(), $payment, $this->actingAsAdmin()->id);

        $this->assertDatabaseCount('commission_payments', 1);
        $this->assertDatabaseHas('invoices', ['id' => $invoice['id'], 'commission_amount' => 500]);
    }
}
