<?php

namespace Tests\Feature;

use App\Mail\InvoiceStatusMail;
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
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Notification email au client lors de la validation / rejection d'une facture.
 * À chaque changement de statut, le mail InvoiceStatusMail est expédié à l'adresse
 * du client avec le numéro de facture, le montant et le motif de rejet éventuel.
 */
class InvoiceStatusNotificationTest extends TestCase
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

    public function test_validation_sends_status_mail_to_client(): void
    {
        Mail::fake();
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertOk();

        Mail::assertSent(InvoiceStatusMail::class, function (InvoiceStatusMail $mail) use ($invoice) {
            return $mail->hasTo($invoice->client->email)
                && $mail->invoice->id === $invoice->id
                && $mail->invoice->validation_status === Invoice::VALIDATION_VALIDATED
                && $mail->clientUrl !== null;
        });
    }

    public function test_rejection_sends_status_mail_to_client_with_reason(): void
    {
        Mail::fake();
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/reject", [
            'rejection_reason' => 'Preuve de paiement illisible',
        ])->assertOk();

        Mail::assertSent(InvoiceStatusMail::class, function (InvoiceStatusMail $mail) use ($invoice) {
            return $mail->hasTo($invoice->client->email)
                && $mail->invoice->id === $invoice->id
                && $mail->invoice->validation_status === Invoice::VALIDATION_REJECTED
                && $mail->invoice->rejection_reason === 'Preuve de paiement illisible';
        });
    }

    public function test_no_mail_when_status_unchanged(): void
    {
        Mail::fake();
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertOk();
        $this->postJson("/api/invoices/{$invoice->id}/validate")->assertStatus(422);

        Mail::assertSent(InvoiceStatusMail::class, 1);
    }
}