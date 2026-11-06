<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\User;
use App\Services\AccountingService;
use App\Services\FinancialMetricsService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * T1.9 — invariants du calcul financier unique.
 *
 * Couvre les cas limites listés au plan : facture partielle, acompte, facture
 * annulée, facture rejetée, encaissement d'une facture antérieure — et vérifie
 * qu'un même périmètre renvoie le même CA sur tous les écrans.
 */
class FinancialMetricsConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
    }

    private function invoice(string $date, float $total, float $paid, string $validation = Invoice::VALIDATION_VALIDATED, array $extra = []): Invoice
    {
        $this->seq++;

        return Invoice::create(array_merge([
            'number' => sprintf('PK-CONS-%03d', $this->seq),
            'agency_id' => $this->agency->id,
            'invoice_date' => $date,
            'total_amount' => $total,
            'amount_paid' => $paid,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => $paid >= $total ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
            'validation_status' => $validation,
            'source' => 'in_person',
        ], $extra));
    }

    private function pay(Invoice $invoice, float $amount, string $date): void
    {
        $payment = InvoicePayment::create([
            'invoice_id' => $invoice->id,
            'amount' => $amount,
            'payment_method' => 'cash',
            'paid_at' => $date,
        ]);
        app(AccountingService::class)->recordIncomeFromPayment($invoice, $payment);
    }

    private function mixedScenario(): void
    {
        $partial = $this->invoice('2026-11-10', 100000, 40000);   // partielle + acompte
        $this->pay($partial, 40000, '2026-11-10');

        $sold = $this->invoice('2026-11-11', 50000, 50000);
        $this->pay($sold, 50000, '2026-11-11');

        $this->invoice('2026-11-12', 20000, 0, Invoice::VALIDATION_VALIDATED, ['cancelled_at' => '2026-11-13']);
        $this->invoice('2026-11-13', 30000, 0, Invoice::VALIDATION_REJECTED);

        $old = $this->invoice('2026-10-15', 10000, 10000);        // recouvrement en novembre
        $this->pay($old, 10000, '2026-11-14');
    }

    public function test_invariant_holds_on_edge_cases(): void
    {
        $this->mixedScenario();

        $kpi = app(FinancialMetricsService::class)->summary(
            Carbon::parse('2026-11-01'),
            Carbon::parse('2026-11-30 23:59:59'),
            [$this->agency->id]
        );

        // Annulée et rejetée exclues : 100 000 + 50 000.
        $this->assertSame(150000.0, $kpi['ca']);
        // Encaissé : 40 000 + 50 000 + 10 000 de recouvrement.
        $this->assertSame(100000.0, $kpi['encaisse']);
        $this->assertSame(10000.0, $kpi['recoveries']);
        $this->assertSame(40000.0, $kpi['acomptes']);
        $this->assertSame(60000.0, $kpi['impayes']);
        $this->assertTrue($kpi['control_ok']);
        $this->assertSame($kpi['ca'], $kpi['collected_on_period_invoices'] + $kpi['impayes']);
        $this->assertSame(75000.0, $kpi['panier_moyen']); // 150 000 ÷ 2 factures
    }

    public function test_every_financial_screen_returns_the_same_revenue(): void
    {
        $this->mixedScenario();
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $q = 'from=2026-11-01&to=2026-11-30';

        $this->getJson("/api/metrics/summary?{$q}")->assertOk()->assertJsonPath('ca', 150000);
        $this->getJson("/api/stats/group?{$q}")->assertOk()->assertJsonPath('revenue', 150000);
        $this->getJson("/api/stats/overview?{$q}")->assertOk()->assertJsonPath('revenue', 150000);
        $this->getJson("/api/stats/agency/{$this->agency->id}?{$q}")->assertOk()->assertJsonPath('revenue', 150000);
        $this->getJson("/api/dashboard?{$q}")->assertOk()->assertJsonPath('kpis.revenue', 150000);
        $this->getJson("/api/reports/comparison?{$q}&dimension=agency")->assertOk()->assertJsonPath('total_revenue', 150000);
        $this->getJson("/api/reports/customers?{$q}")->assertOk()->assertJsonPath('totals.turnover', 150000);
    }
}
