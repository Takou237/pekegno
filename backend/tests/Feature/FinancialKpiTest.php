<?php

namespace Tests\Feature;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\CommissionEntry;
use App\Models\Course;
use App\Models\Department;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
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
 * Calcul unique des cartes financières (cahier, section 1) et annulation qui
 * contre-passe paiements, recettes et commissions (B9).
 */
class FinancialKpiTest extends TestCase
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
            'number' => sprintf('PK-TEST-%03d', $this->seq),
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

    private function pay(Invoice $invoice, float $amount, string $date): InvoicePayment
    {
        $payment = InvoicePayment::create([
            'invoice_id' => $invoice->id,
            'amount' => $amount,
            'payment_method' => 'cash',
            'paid_at' => $date,
        ]);
        app(AccountingService::class)->recordIncomeFromPayment($invoice, $payment);

        return $payment;
    }

    /** Novembre : une facture du mois, une ancienne recouvrée, une en attente, une annulée, une dépense. */
    private function scenario(): array
    {
        $current = $this->invoice('2026-11-10', 100000, 40000);
        $this->pay($current, 40000, '2026-11-10');

        $old = $this->invoice('2026-10-15', 30000, 30000);
        $this->pay($old, 20000, '2026-10-15');
        $this->pay($old, 10000, '2026-11-12');

        $this->invoice('2026-11-11', 50000, 0, Invoice::VALIDATION_PENDING, ['declared_advance' => 20000]);

        $cancelled = $this->invoice('2026-11-05', 15000, 15000, Invoice::VALIDATION_VALIDATED, ['cancelled_at' => '2026-11-06']);
        $this->pay($cancelled, 15000, '2026-11-05');

        AccountingTransaction::create([
            'number' => app(AccountingService::class)->nextNumber(),
            'agency_id' => $this->agency->id,
            'type' => 'expense',
            'label' => 'Transport',
            'amount' => 5000,
            'transacted_at' => '2026-11-12',
        ]);

        return [$current, $old, $cancelled];
    }

    public function test_summary_follows_the_cahier_rules(): void
    {
        $this->scenario();

        $kpi = app(FinancialMetricsService::class)->summary(
            Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30 23:59:59'), [$this->agency->id]
        );

        $this->assertSame(100000.0, $kpi['revenue']);          // factures validées du mois, pas l'encaissé
        $this->assertSame(1, $kpi['invoices_validated']);
        $this->assertSame(50000.0, $kpi['collected']);          // 40 000 + 10 000 reçus en novembre
        $this->assertSame(10000.0, $kpi['recoveries']);         // dont ancienne facture d'octobre
        $this->assertSame(40000.0, $kpi['advances']);           // versé sur la facture non soldée
        $this->assertSame(60000.0, $kpi['outstanding']);
        $this->assertSame(5000.0, $kpi['expenses']);
        $this->assertSame(20000.0, $kpi['pending_validation']); // avance annoncée, non validée
        $this->assertSame(45000.0, $kpi['net_cash']);
        $this->assertSame(100000.0, $kpi['average_basket']);
        $this->assertTrue($kpi['control_ok']);                  // 100 000 = 40 000 + 60 000
    }

    public function test_all_pages_show_the_same_revenue(): void
    {
        $this->scenario();
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $q = 'from=2026-11-01&to=2026-11-30';

        $this->getJson("/api/stats/group?{$q}")->assertOk()->assertJsonPath('revenue', 100000);
        $this->getJson("/api/stats/overview?{$q}")->assertOk()->assertJsonPath('revenue', 100000);
        $this->getJson("/api/stats/agency/{$this->agency->id}?{$q}")->assertOk()->assertJsonPath('revenue', 100000);
        $this->getJson("/api/dashboard?{$q}")->assertOk()->assertJsonPath('kpis.revenue', 100000);
        $this->getJson("/api/reports/comparison?{$q}&dimension=agency")->assertOk()->assertJsonPath('total_revenue', 100000);
        $this->getJson("/api/reports/customers?{$q}")->assertOk()->assertJsonPath('totals.turnover', 100000);
    }

    public function test_cancelling_an_invoice_reverses_payments_income_and_commissions(): void
    {
        $invoice = $this->invoice('2026-11-10', 50000, 50000);
        $payment = $this->pay($invoice, 50000, '2026-11-10');
        $entry = CommissionEntry::create([
            'invoice_id' => $invoice->id,
            'invoice_payment_id' => $payment->id,
            'base_amount' => 50000,
            'amount' => 2500,
            'rule_snapshot' => ['type' => 'percent', 'value' => 5],
            'status' => CommissionEntry::STATUS_CALCULATED,
            'category' => 'service',
        ]);

        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $this->postJson("/api/invoices/{$invoice->id}/cancel", ['cancellation_reason' => 'Facture annulée pour le test'])->assertOk();

        $this->assertNotNull($payment->fresh()->cancelled_at);
        $this->assertSame(0.0, (float) AccountingTransaction::where('invoice_id', $invoice->id)->where('type', 'income')->sum('amount'));
        $this->assertSame(2, AccountingTransaction::where('invoice_id', $invoice->id)->count()); // recette + contre-passation (trace)
        $this->assertSame(CommissionEntry::STATUS_CANCELLED, $entry->fresh()->status);

        // Rejouer l'annulation (rattrapage) ne contre-passe pas deux fois.
        $this->artisan('invoices:reverse-cancelled-payments', ['--apply' => true])->assertSuccessful();
        $this->assertSame(2, AccountingTransaction::where('invoice_id', $invoice->id)->count());
    }

    public function test_department_cards_split_the_agency_revenue(): void
    {
        $academy = Department::create(['agency_id' => $this->agency->id, 'name' => 'Academy', 'type' => Department::TYPE_ACADEMY]);
        $agencyDept = Department::create(['agency_id' => $this->agency->id, 'name' => 'Agency', 'type' => Department::TYPE_AGENCY]);

        $course = Course::factory()->create(['price' => 80000, 'agency_id' => $this->agency->id]);
        $training = $this->invoice('2026-11-10', 80000, 0);
        FormationEnrollment::create(['course_id' => $course->id, 'learner_user_id' => User::factory()->create()->id,
            'invoice_id' => $training->id, 'enrolled_at' => '2026-11-10', 'status' => 'enrolled']);
        $this->invoice('2026-11-11', 30000, 0); // vente sans contrat ni inscription → département Agency

        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $q = 'from=2026-11-01&to=2026-11-30';

        $this->getJson("/api/stats/agency/{$this->agency->id}?{$q}")->assertJsonPath('revenue', 110000);
        $this->getJson("/api/stats/agency/{$this->agency->id}?{$q}&department_id={$academy->id}")->assertJsonPath('revenue', 80000);
        $this->getJson("/api/stats/agency/{$this->agency->id}?{$q}&department_id={$agencyDept->id}")->assertJsonPath('revenue', 30000);
    }

    public function test_metrics_endpoint_exposes_the_single_financial_contract(): void
    {
        $this->scenario();
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $q = 'from=2026-11-01&to=2026-11-30';

        $this->getJson("/api/metrics/summary?{$q}")
            ->assertOk()
            ->assertJsonPath('ca', 100000)
            ->assertJsonPath('encaisse', 50000)
            ->assertJsonPath('impayes', 60000)
            ->assertJsonPath('acomptes', 40000)
            ->assertJsonPath('depenses', 5000)
            ->assertJsonPath('en_attente_validation', 20000)
            ->assertJsonPath('net_caisse', 45000)
            ->assertJsonPath('control_ok', true)
            ->assertJsonStructure(['period' => ['from', 'to'], 'currency_code']);

        $this->getJson("/api/metrics/breakdown?{$q}")
            ->assertOk()
            ->assertJsonPath('by_mode.total', 50000)
            ->assertJsonPath('by_mode.buckets.cash', 50000)
            ->assertJsonPath('by_agency.0.revenue', 100000)
            ->assertJsonPath('by_agency.0.collected', 50000);
    }

    public function test_metrics_breakdown_sums_match_the_summary(): void
    {
        $this->scenario();
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $q = 'from=2026-11-01&to=2026-11-30';

        $summary = $this->getJson("/api/metrics/summary?{$q}")->assertOk()->json();
        $breakdown = $this->getJson("/api/metrics/breakdown?{$q}")->assertOk()->json();

        $this->assertSame($summary['ca'], array_sum(array_column($breakdown['by_agency'], 'revenue')));
        $this->assertSame($summary['encaisse'], $breakdown['by_mode']['total']);
        $this->assertSame($summary['encaisse'], array_sum(array_column($breakdown['by_agency'], 'collected')));
    }

    public function test_collected_uses_the_reception_date_and_ignores_rejected_payments(): void
    {
        $invoice = $this->invoice('2026-11-30', 10000, 10000);
        $payment = InvoicePayment::create([
            'invoice_id' => $invoice->id,
            'amount' => 10000,
            'payment_method' => 'cash',
            'paid_at' => '2026-11-30',
            'received_at' => '2026-12-02',
        ]);

        $service = app(FinancialMetricsService::class);
        $november = $service->summary(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30 23:59:59'), [$this->agency->id]);
        $december = $service->summary(Carbon::parse('2026-12-01'), Carbon::parse('2026-12-31 23:59:59'), [$this->agency->id]);

        $this->assertSame(10000.0, $november['ca']);
        $this->assertSame(0.0, $november['collected']);
        $this->assertSame(10000.0, $december['collected']);
        $this->assertSame(10000.0, $december['recoveries']);

        // Un paiement rejeté n'est jamais encaissé, même s'il est daté dans la période.
        $payment->update(['validation_status' => 'rejected']);
        $december = $service->summary(Carbon::parse('2026-12-01'), Carbon::parse('2026-12-31 23:59:59'), [$this->agency->id]);
        $this->assertSame(0.0, $december['collected']);
    }

    public function test_pass_through_budget_is_excluded_from_revenue_and_collected(): void
    {
        $invoice = $this->invoice('2026-11-10', 100000, 100000);
        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'label' => 'Budget publicitaire client',
            'unit_price' => 30000,
            'quantity' => 1,
            'line_total' => 30000,
            'is_pass_through' => true,
        ]);
        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'label' => 'Prestation Pekegno',
            'unit_price' => 70000,
            'quantity' => 1,
            'line_total' => 70000,
            'is_pass_through' => false,
        ]);
        $this->pay($invoice, 100000, '2026-11-10');

        $kpi = app(FinancialMetricsService::class)->summary(
            Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30 23:59:59'), [$this->agency->id]
        );

        $this->assertSame(70000.0, $kpi['ca']);
        $this->assertSame(70000.0, $kpi['encaisse']);
        $this->assertTrue($kpi['control_ok']);
    }

    public function test_agency_filter_narrows_the_metrics_to_the_scope(): void
    {
        $this->scenario();
        $other = Agency::factory()->create();
        $invoice = Invoice::create([
            'number' => 'PK-OTHER-001',
            'agency_id' => $other->id,
            'invoice_date' => '2026-11-10',
            'total_amount' => 90000,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ]);

        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));

        $this->getJson("/api/metrics/summary?from=2026-11-01&to=2026-11-30&agency_id={$this->agency->id}")
            ->assertOk()
            ->assertJsonPath('ca', 100000)
            ->assertJsonPath('converted', false);

        $this->getJson("/api/metrics/summary?from=2026-11-01&to=2026-11-30&agency_id={$other->id}")
            ->assertOk()
            ->assertJsonPath('ca', 90000);

        $this->assertSame(90000.0, (float) $invoice->fresh()->total_amount);
    }

    public function test_course_revenue_counts_each_enrollment_once(): void
    {
        $course = Course::factory()->create(['price' => 189000, 'agency_id' => $this->agency->id]);
        // 4 sessions : l'ancien calcul multipliait par le nombre de sessions (B7).
        \App\Models\TrainingSession::factory()->count(4)->create(['course_id' => $course->id]);
        $discounted = $this->invoice('2026-11-10', 150000, 0);
        FormationEnrollment::create(['course_id' => $course->id, 'learner_user_id' => User::factory()->create()->id,
            'invoice_id' => $discounted->id, 'enrolled_at' => '2026-11-10', 'status' => 'enrolled']);
        FormationEnrollment::create(['course_id' => $course->id, 'learner_user_id' => User::factory()->create()->id,
            'enrolled_at' => '2026-11-10', 'status' => 'enrolled']);

        $enrollments = FormationEnrollment::where('course_id', $course->id)->with('invoice')->get();

        // 150 000 (facture remisée) + 189 000 (sans facture, prix de la formation).
        $this->assertSame(339000.0, \App\Services\AcademyReportService::enrollmentsRevenue($enrollments, $course->fresh()));
    }
}
