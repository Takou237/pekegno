<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use App\Services\AccountingService;
use App\Services\CommercialMonthlyReportService;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Recouvrement d'un reste à payer sur une facture d'un mois précédent
 * (cas prod PK-20261022-014 : 100 000 le 22/10 puis 100 000 le 02/11).
 */
class RecoveryPaymentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);
    }

    private function makeInvoice(Commercial $commercial, Agency $agency, string $date): Invoice
    {
        $invoice = Invoice::create([
            'number' => 'PK-TEST-'.uniqid(),
            'agency_id' => $agency->id,
            'commercial_id' => $commercial->id,
            'client_name' => 'Client Test',
            'invoice_date' => $date,
            'payment_type' => 'momo',
            'total_amount' => 400000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);
        $invoice->items()->create([
            'label' => 'Formation Marketing Digital',
            'unit_price' => 400000,
            'quantity' => 1,
            'line_total' => 400000,
        ]);

        return $invoice;
    }

    private function pay(Invoice $invoice, float $amount, string $paidAt, string $userId): void
    {
        $payment = $invoice->payments()->create([
            'amount' => $amount,
            'payment_method' => 'om',
            'is_advance' => false,
            'paid_at' => $paidAt,
            'received_by' => $userId,
        ]);
        $invoice->increment('amount_paid', $amount);

        app(AccountingService::class)->recordIncomeFromPayment($invoice->fresh(), $payment);
    }

    public function test_second_payment_of_same_amount_gets_its_own_accounting_entry(): void
    {
        $agency = Agency::factory()->create();
        $commercial = Commercial::factory()->create(['agency_id' => $agency->id]);
        $cashier = User::factory()->create(['role_id' => Role::where('name', 'caissier')->value('id')]);
        $invoice = $this->makeInvoice($commercial, $agency, '2026-10-22 14:41:23');

        $this->pay($invoice, 100000, '2026-10-22 14:41:23', $cashier->id);
        $this->pay($invoice, 100000, '2026-11-02 09:31:12', $cashier->id);

        $this->assertDatabaseCount('accounting_transactions', 2);

        // Ré-exécution (backfill) : aucune écriture supplémentaire.
        foreach ($invoice->payments as $payment) {
            $this->assertNull(app(AccountingService::class)->recordIncomeFromPayment($invoice->fresh(), $payment));
        }
        $this->assertDatabaseCount('accounting_transactions', 2);
    }

    public function test_monthly_report_shows_recovery_on_invoice_from_previous_month(): void
    {
        $agency = Agency::factory()->create();
        $commercial = Commercial::factory()->create(['agency_id' => $agency->id]);
        $cashier = User::factory()->create(['role_id' => Role::where('name', 'caissier')->value('id')]);
        $invoice = $this->makeInvoice($commercial, $agency, '2026-10-22 14:41:23');

        $this->pay($invoice, 100000, '2026-10-22 14:41:23', $cashier->id);
        $this->pay($invoice, 100000, '2026-11-02 09:31:12', $cashier->id);

        $service = app(CommercialMonthlyReportService::class);
        $tz = 'Africa/Douala';

        $november = $service->detail(
            $commercial,
            Carbon::parse('2026-11-01', $tz)->startOfDay()->utc(),
            Carbon::parse('2026-11-30', $tz)->endOfDay()->utc(),
        );

        // La facture d'octobre ne compte pas dans les ventes de novembre…
        $this->assertEquals(0, $november['totals']['billed']);
        $this->assertEquals(0, $november['totals']['received']);
        // … mais son recouvrement du 02/11 apparaît.
        $this->assertEquals(100000, $november['totals']['recovered']);
        $this->assertEquals(100000, $november['totals']['collected']);
        $this->assertCount(1, $november['tabs']['academy']['recoveries']);
        $this->assertSame('2026-11-02', $november['tabs']['academy']['recoveries'][0]['date']);
        $this->assertSame($invoice->number, $november['tabs']['academy']['recoveries'][0]['invoice_number']);

        // Octobre : la vente et son premier versement, pas de recouvrement.
        $october = $service->detail(
            $commercial,
            Carbon::parse('2026-10-01', $tz)->startOfDay()->utc(),
            Carbon::parse('2026-10-31', $tz)->endOfDay()->utc(),
        );
        $this->assertEquals(400000, $october['totals']['billed']);
        $this->assertEquals(100000, $october['totals']['received']);
        $this->assertEquals(0, $october['totals']['recovered']);
    }

    public function test_linked_invoices_sorted_by_last_activity_put_recent_recovery_first(): void
    {
        $agency = Agency::factory()->create();
        $commercial = Commercial::factory()->create(['agency_id' => $agency->id]);
        $cashier = User::factory()->create(['role_id' => Role::where('name', 'caissier')->value('id')]);

        $old = $this->makeInvoice($commercial, $agency, '2026-10-22 14:41:23');
        $recent = $this->makeInvoice($commercial, $agency, '2026-10-30 10:00:00');
        $this->pay($old, 100000, '2026-10-22 14:41:23', $cashier->id);
        $this->pay($recent, 50000, '2026-10-30 10:00:00', $cashier->id);
        $this->pay($old, 100000, '2026-11-02 09:31:12', $cashier->id);

        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));

        // Tri par défaut inchangé : date de facture.
        $default = $this->getJson("/api/invoices?commercial_id={$commercial->id}")->assertOk()->json('invoices.data');
        $this->assertSame([$recent->number, $old->number], array_column($default, 'number'));

        // Dernière activité : le recouvrement du 02/11 fait remonter la facture du 22/10.
        $sorted = $this->getJson("/api/invoices?commercial_id={$commercial->id}&sort=last_activity")->assertOk()->json('invoices.data');
        $this->assertSame([$old->number, $recent->number], array_column($sorted, 'number'));
        $this->assertStringStartsWith('2026-11-02', (string) $sorted[0]['last_payment_at']);
    }
}
