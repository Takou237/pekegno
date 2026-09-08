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
use Tests\TestCase;

/**
 * Reçu PDF téléchargeable côté client (Phase 6.2 optionnel).
 * Le client ne peut télécharger que ses propres factures.
 */
class ClientInvoiceReceiptTest extends TestCase
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

    private function clientUser(): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        $this->withToken($user->createToken('client-token')->plainTextToken);

        return $user;
    }

    private function makeInvoice(User $client): Invoice
    {
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

    public function test_client_can_download_receipt_pdf_of_own_invoice(): void
    {
        $client = $this->clientUser();
        $invoice = $this->makeInvoice($client);

        $response = $this->getJson("/api/client/invoices/{$invoice->id}/receipt");

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type'));
        $this->assertStringContainsString('facture-'.$invoice->number, $response->headers->get('content-disposition'));
        $this->assertGreaterThan(1000, strlen($response->getContent()));
    }

    public function test_client_cannot_download_another_clients_receipt(): void
    {
        $this->clientUser();
        $other = User::factory()->create([
            'role_id' => Role::where('name', 'client')->value('id'),
        ]);
        $invoice = $this->makeInvoice($other);

        $this->getJson("/api/client/invoices/{$invoice->id}/receipt")->assertNotFound();
    }

    public function test_receipt_is_valid_pdf_stream(): void
    {
        $client = $this->clientUser();
        $invoice = $this->makeInvoice($client);

        $content = $this->getJson("/api/client/invoices/{$invoice->id}/receipt")->getContent();

        $this->assertStringStartsWith('%PDF-', $content);
    }
}