<?php

namespace Tests\Feature;

use App\Mail\CommercialInvoiceRejectionMail;
use App\Mail\InvoiceStatusMail;
use App\Models\Agency;
use App\Models\AgencyNotification;
use App\Models\Commercial;
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
 * Notification au client (et au commercial vendeur) lors de la validation /
 * rejection d'une facture. À chaque changement de statut, le mail InvoiceStatusMail
 * est expédié à l'adresse du client avec le numéro de facture, le montant et le
 * motif de rejet éventuel ; un rejet notifie aussi en in-app (agency_notifications)
 * le client seul (commande client_self) ou le commercial + le client (vente commerciale).
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

    /**
     * Commande passée par le client (`client_self`) → seul le client est notifié,
     * en in-app comme par email, avec le motif du refus.
     */
    public function test_client_self_rejection_notifies_the_client_in_app_with_reason(): void
    {
        Mail::fake();
        $this->staffWithRole('caissier');
        $invoice = $this->pendingInvoice();

        $this->postJson("/api/invoices/{$invoice->id}/reject", [
            'rejection_reason' => 'Preuve de paiement illisible',
        ])->assertOk();

        $notification = AgencyNotification::where('type', 'invoice_rejected')
            ->where('user_id', $invoice->client_id)
            ->first();

        $this->assertNotNull($notification, 'Le client doit recevoir une notification in-app de rejet.');
        $this->assertSame($invoice->id, $notification->entity_id);
        $this->assertStringContainsString('Preuve de paiement illisible', (string) $notification->body);
        $this->assertStringContainsString($invoice->number, (string) $notification->title);

        $this->assertSame(1, AgencyNotification::where('type', 'invoice_rejected')->count());
    }

    /**
     * Vente enregistrée par un commercial → le commercial ET le client sont
     * notifiés (in-app + email) avec le motif du refus.
     */
    public function test_commercial_sale_rejection_notifies_commercial_and_client(): void
    {
        Mail::fake();
        $this->staffWithRole('caissier');

        $commercialUser = User::factory()->create([
            'role_id' => Role::where('name', 'commercial')->value('id'),
        ]);
        $commercial = Commercial::factory()->create([
            'user_id' => $commercialUser->id,
            'agency_id' => Agency::factory()->create()->id,
        ]);

        $invoice = $this->pendingInvoice();
        $invoice->update([
            'source' => 'commercial_online',
            'commercial_id' => $commercial->id,
        ]);

        $this->postJson("/api/invoices/{$invoice->id}/reject", [
            'rejection_reason' => 'Montant incohérent avec la commande',
        ])->assertOk();

        $clientNotification = AgencyNotification::where('type', 'invoice_rejected')
            ->where('user_id', $invoice->client_id)
            ->first();
        $commercialNotification = AgencyNotification::where('type', 'invoice_rejected')
            ->where('user_id', $commercialUser->id)
            ->first();

        $this->assertNotNull($clientNotification, 'Le client doit être notifié.');
        $this->assertNotNull($commercialNotification, 'Le commercial vendeur doit être notifié.');
        $this->assertStringContainsString('Montant incohérent avec la commande', (string) $clientNotification->body);
        $this->assertStringContainsString('Montant incohérent avec la commande', (string) $commercialNotification->body);

        Mail::assertSent(InvoiceStatusMail::class, fn (InvoiceStatusMail $mail) => $mail->hasTo($invoice->client->email));
        Mail::assertSent(CommercialInvoiceRejectionMail::class, fn (CommercialInvoiceRejectionMail $mail) => $mail->hasTo($commercial->email));
    }

    /**
     * Le rendu des deux emails de rejet ne doit pas exploiter (motif inclus).
     */
    public function test_rejection_mails_render(): void
    {
        Mail::fake();
        $this->staffWithRole('caissier');

        $commercial = Commercial::factory()->create([
            'user_id' => User::factory()->create([
                'role_id' => Role::where('name', 'commercial')->value('id'),
            ])->id,
            'agency_id' => Agency::factory()->create()->id,
        ]);

        $invoice = $this->pendingInvoice();
        $invoice->update(['commercial_id' => $commercial->id, 'source' => 'commercial_in_person']);

        $this->postJson("/api/invoices/{$invoice->id}/reject", [
            'rejection_reason' => 'Justificatif manquant',
        ])->assertOk();

        Mail::assertSent(InvoiceStatusMail::class, function (InvoiceStatusMail $mail) {
            $html = $mail->render();

            return str_contains($html, 'Motif du rejet') && str_contains($html, 'Justificatif manquant');
        });
        Mail::assertSent(CommercialInvoiceRejectionMail::class, function (CommercialInvoiceRejectionMail $mail) {
            $html = $mail->render();

            return str_contains($html, 'Motif du refus') && str_contains($html, 'Justificatif manquant');
        });
    }
}