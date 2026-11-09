<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B8 — « Toute facture reste visible avec son statut ».
 *
 *  - la liste par défaut montre toutes les factures NON annulées, quel que soit
 *    leur statut de validation (en attente, validée, rejetée) ;
 *  - chaque ligne expose son statut de validation ;
 *  - une facture annulée ne disparaît pas : elle est accessible via le filtre
 *    « Annulée » et via include_cancelled=1, avec son statut « Annulée ».
 */
class InvoiceAlwaysVisibleTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
    }

    private function user(string $role = 'super-admin'): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function invoice(string $number, string $validationStatus, array $extra = []): Invoice
    {
        return Invoice::create(array_merge([
            'number' => $number,
            'agency_id' => $this->agency->id,
            'invoice_date' => '2026-11-01',
            'total_amount' => 50000,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => $validationStatus,
            'source' => 'in_person',
        ], $extra));
    }

    /**
     * @return array<string, string> numéro de facture => statut de validation
     */
    private function listedInvoices(string $query = ''): array
    {
        $rows = $this->getJson('/api/invoices?per_page=50'.$query)->assertOk()->json('invoices.data');

        return collect($rows)->mapWithKeys(fn ($row) => [
            $row['number'] => $row['validation_status'].'|'.$row['status'],
        ])->all();
    }

    public function test_default_list_shows_every_non_cancelled_invoice_with_its_validation_status(): void
    {
        Sanctum::actingAs($this->user());

        $this->invoice('PK-20261101-007', Invoice::VALIDATION_PENDING);
        $this->invoice('PK-20261101-008', Invoice::VALIDATION_VALIDATED);
        // Contrôle de réception du cahier : une facture rejetée reste visible.
        $this->invoice('PK-20261101-009', Invoice::VALIDATION_REJECTED);
        $this->invoice('PK-20261101-010', Invoice::VALIDATION_VALIDATED, [
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $listed = $this->listedInvoices();

        $this->assertArrayHasKey('PK-20261101-007', $listed);
        $this->assertArrayHasKey('PK-20261101-008', $listed);
        $this->assertArrayHasKey('PK-20261101-009', $listed);
        $this->assertArrayNotHasKey('PK-20261101-010', $listed);

        $this->assertSame(Invoice::VALIDATION_PENDING.'|unpaid', $listed['PK-20261101-007']);
        $this->assertSame(Invoice::VALIDATION_VALIDATED.'|unpaid', $listed['PK-20261101-008']);
        $this->assertSame(Invoice::VALIDATION_REJECTED.'|unpaid', $listed['PK-20261101-009']);

        // Les cartes de totaux portent sur le même périmètre que la liste.
        $this->assertSame(3, $this->getJson('/api/invoices?per_page=50')->assertOk()->json('invoices.meta.total'));
    }

    public function test_cancelled_invoices_are_reachable_through_their_filter(): void
    {
        Sanctum::actingAs($this->user());

        $this->invoice('PK-20261101-011', Invoice::VALIDATION_VALIDATED);
        $this->invoice('PK-20261101-012', Invoice::VALIDATION_VALIDATED, [
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $canceled = $this->listedInvoices('&status=cancelled');

        $this->assertSame(['PK-20261101-012'], array_keys($canceled));
        $this->assertSame(Invoice::VALIDATION_VALIDATED.'|cancelled', $canceled['PK-20261101-012']);
    }

    public function test_cancelling_an_invoice_requires_a_journalized_reason(): void
    {
        Sanctum::actingAs($this->user());
        $invoice = $this->invoice('PK-20261101-015', Invoice::VALIDATION_VALIDATED);

        // Sans motif (ou avec des blancs) : refusé, rien n'est annulé.
        $this->postJson("/api/invoices/{$invoice->id}/cancel")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cancellation_reason');

        $this->postJson("/api/invoices/{$invoice->id}/cancel", ['cancellation_reason' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cancellation_reason');

        $this->assertNull($invoice->fresh()->cancelled_at);

        // Avec motif : annulée, et le motif part dans le journal d'activité.
        $this->postJson("/api/invoices/{$invoice->id}/cancel", [
            'cancellation_reason' => 'Doublon de facture',
        ])->assertOk();

        $cancelled = $invoice->fresh();
        $this->assertNotNull($cancelled->cancelled_at);
        $this->assertSame('cancelled', $cancelled->status);

        $log = ActivityLog::where('action', 'cancelled')
            ->where('entity_type', 'invoice')
            ->where('entity_id', $invoice->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertStringContainsString('Doublon de facture', (string) $log->description);
        $this->assertSame('Doublon de facture', $log->new_values['cancellation_reason'] ?? null);
    }

    public function test_include_cancelled_returns_every_invoice(): void
    {
        Sanctum::actingAs($this->user());

        $this->invoice('PK-20261101-013', Invoice::VALIDATION_REJECTED);
        $this->invoice('PK-20261101-014', Invoice::VALIDATION_VALIDATED, [
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $listed = $this->listedInvoices('&include_cancelled=1');

        $this->assertArrayHasKey('PK-20261101-013', $listed);
        $this->assertArrayHasKey('PK-20261101-014', $listed);
    }
}
