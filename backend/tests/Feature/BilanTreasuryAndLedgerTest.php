<?php

namespace Tests\Feature;

use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\Category;
use App\Models\DailyBalance;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\Service;
use App\Models\TreasuryAccount;
use App\Models\User;
use App\Services\AccountingService;
use App\Services\BilanService;
use App\Services\DepartmentLedger;
use App\Services\FinancialMetricsService;
use App\Services\PaymentService;
use App\Services\TreasuryAccountProvisioner;
use App\Services\TreasuryService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Bilan du jour (07/11) : soldes lus dans les caisses (cahier §2), total
 * période (B5), solde initial consolidé (B6), date de réception (B11) ; et
 * rattachement des ventes directes au département de leur catégorie.
 */
class BilanTreasuryAndLedgerTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-03 10:00:00');
        $this->admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function agency(): Agency
    {
        $agency = Agency::factory()->create();
        app(TreasuryAccountProvisioner::class)->ensureForAgency($agency);

        return $agency;
    }

    private function box(Agency $agency, string $code): TreasuryAccount
    {
        return TreasuryAccount::where('agency_id', $agency->id)->where('code', $code)->firstOrFail();
    }

    private function invoice(Agency $agency, float $amount, array $extra = []): Invoice
    {
        $this->seq++;

        return Invoice::create(array_merge([
            'number' => sprintf('PK-BIL-%03d', $this->seq),
            'agency_id' => $agency->id,
            'invoice_date' => '2026-11-02',
            'total_amount' => $amount,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ], $extra));
    }

    private function pay(Agency $agency, float $amount, string $method, string $receivedAt, ?string $paidAt = null): Invoice
    {
        $invoice = $this->invoice($agency, $amount);
        app(PaymentService::class)->applyPayment($invoice, $amount, $method, false, $this->admin->id, null, $paidAt ?? $receivedAt, $receivedAt);

        return $invoice;
    }

    private function bilan(): BilanService
    {
        return app(BilanService::class);
    }

    // --- Cahier §2 : les ventes d'un côté, les caisses de l'autre --------------

    public function test_daily_bilan_shows_each_cash_box(): void
    {
        // Douala 02/11 : C = 260 000 + 145 000 − 24 000 = 381 000 ; OM et MTN dans O et M.
        $agency = $this->agency();
        $this->box($agency, 'C')->update(['opening_balance' => 260000]);
        $this->pay($agency, 145000, 'cash', '2026-11-02 09:00:00');
        $this->pay($agency, 300000, 'om', '2026-11-02 10:00:00');
        $this->pay($agency, 105000, 'momo', '2026-11-02 11:00:00');
        app(TreasuryService::class)->recordMovement($this->box($agency, 'C'), 'out', 24000, 'Dépenses du jour', transactedAt: '2026-11-02 12:00:00');

        $day = $this->bilan()->daily(Carbon::parse('2026-11-02'), $agency->id);
        $boxes = collect($day['treasury_accounts'])->keyBy('code');

        $this->assertSame(550000.0, (float) $day['total_received']);
        $this->assertSame(260000.0, $boxes['C']['opening']);
        $this->assertSame(145000.0, $boxes['C']['in']);
        $this->assertSame(24000.0, $boxes['C']['out']);
        $this->assertSame(381000.0, $boxes['C']['closing']);
        $this->assertSame(300000.0, $boxes['O']['closing']);
        $this->assertSame(105000.0, $boxes['M']['closing']);
        $this->assertSame(786000.0, $day['solde_final']); // total des caisses
    }

    // --- B5 : total période ------------------------------------------------------

    public function test_period_total_takes_first_opening_and_last_closing(): void
    {
        $agency = $this->agency();
        $this->box($agency, 'C')->update(['opening_balance' => 100000]);
        $this->pay($agency, 50000, 'cash', '2026-11-01 09:00:00');
        $this->pay($agency, 20000, 'cash', '2026-11-02 09:00:00');
        app(TreasuryService::class)->recordMovement($this->box($agency, 'C'), 'out', 5000, 'Achat', transactedAt: '2026-11-03 09:00:00');

        $period = $this->bilan()->period(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03'), $agency->id);
        $days = collect($period['days'])->keyBy('date');

        $this->assertSame([100000.0, 150000.0, 170000.0], $days->pluck('solde_initial')->map(fn ($v) => (float) $v)->all());
        $this->assertSame(100000.0, (float) $period['totals']['solde_initial']);
        $this->assertSame(165000.0, (float) $period['totals']['solde_final']);
        $this->assertSame(70000.0, (float) $period['totals']['total_received']);
    }

    // --- B6 : solde initial consolidé ---------------------------------------------

    public function test_consolidated_opening_is_the_sum_of_previous_closings_and_never_rewritten(): void
    {
        $douala = $this->agency();
        $yaounde = $this->agency();
        $this->pay($douala, 210762, 'cash', '2026-11-02 09:00:00');
        $this->pay($yaounde, 896000, 'om', '2026-11-02 09:00:00');

        $closings = collect($this->bilan()->consolidated(Carbon::parse('2026-11-02'), [$douala->id, $yaounde->id])['agencies'])->sum('solde_final');
        $nextDay = $this->bilan()->consolidated(Carbon::parse('2026-11-03'), [$douala->id, $yaounde->id]);

        $this->assertSame(1106762.0, (float) $closings);
        $this->assertSame(1106762.0, (float) $nextDay['totals']['total_solde_initial']);

        // Rouvrir le Bilan ne change rien et n'écrit aucun solde.
        $again = $this->bilan()->consolidated(Carbon::parse('2026-11-03'), [$douala->id, $yaounde->id]);
        $this->assertSame($nextDay['totals'], $again['totals']);
        $this->assertSame(0, DailyBalance::count());
    }

    // --- B11 : date de réception ---------------------------------------------------

    public function test_payment_counts_on_the_day_it_was_received_not_validated(): void
    {
        // Yaoundé : reçu le 02/11 (preuve), validé le 03/11.
        $agency = $this->agency();
        $this->pay($agency, 40000, 'om', '2026-11-02 18:00:00', '2026-11-03 09:00:00');

        $this->assertSame(40000.0, (float) $this->bilan()->daily(Carbon::parse('2026-11-02'), $agency->id)['total_received']);
        $this->assertSame(0.0, (float) $this->bilan()->daily(Carbon::parse('2026-11-03'), $agency->id)['total_received']);
    }

    public function test_cancelled_payments_are_not_in_the_bilan(): void
    {
        $agency = $this->agency();
        $invoice = $this->pay($agency, 15000, 'cash', '2026-11-02 09:00:00');
        $invoice->payments()->update(['cancelled_at' => now()]);

        $this->assertSame(0.0, (float) $this->bilan()->daily(Carbon::parse('2026-11-02'), $agency->id)['total_received']);
    }

    // --- Rattachement des ventes directes ----------------------------------------

    private function departments(Agency $agency, array $types): array
    {
        return collect($types)->mapWithKeys(fn ($type) => [$type => Department::factory()->create(['agency_id' => $agency->id, 'type' => $type])])->all();
    }

    private function directSale(Agency $agency, array $lines): Invoice
    {
        $invoice = $this->invoice($agency, collect($lines)->sum('line_total'));
        foreach ($lines as $line) {
            $invoice->items()->create($line + ['label' => 'Article', 'quantity' => 1, 'unit_price' => $line['line_total']]);
        }

        return $invoice;
    }

    private function service(string $category): Service
    {
        $this->seq++;

        return Service::create([
            'code' => 'SRV-'.$this->seq,
            'name' => $category.' '.$this->seq,
            'price' => 1000,
            'category_id' => Category::firstOrCreate(['name' => $category])->id,
        ]);
    }

    public function test_direct_sales_follow_the_category_of_the_items_sold(): void
    {
        $agency = $this->agency();
        $depts = $this->departments($agency, ['agency', 'store', 'academy', 'studio']);
        $ledger = app(DepartmentLedger::class);

        $book = $this->directSale($agency, [['service_id' => $this->service('Store')->id, 'line_total' => 5000]]);
        $canva = $this->directSale($agency, [['service_id' => $this->service('Canva')->id, 'line_total' => 8000]]); // catégorie libre → Store
        $bootcamp = $this->directSale($agency, [['service_id' => $this->service('Academy')->id, 'line_total' => 50000]]);
        $mixed = $this->directSale($agency, [
            ['service_id' => $this->service('Store')->id, 'line_total' => 3000],
            ['service_id' => $this->service('Academy')->id, 'line_total' => 9000],
        ]);
        $freeLine = $this->directSale($agency, [['line_total' => 2000]]);

        $this->assertSame($depts['store']->id, $ledger->departmentForInvoice($book));
        $this->assertSame($depts['store']->id, $ledger->departmentForInvoice($canva));
        $this->assertSame($depts['academy']->id, $ledger->departmentForInvoice($bootcamp));
        $this->assertSame($depts['academy']->id, $ledger->departmentForInvoice($mixed)); // la catégorie qui pèse le plus
        $this->assertSame($depts['agency']->id, $ledger->departmentForInvoice($freeLine));

        // Même rattachement côté CA, et chaque facture dans un seul département.
        $revenue = fn (Department $d) => app(FinancialMetricsService::class)
            ->summary(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03 23:59:59'), [$agency->id], false, null, $d)['ca'];
        $this->assertSame(13000.0, $revenue($depts['store']));
        $this->assertSame(62000.0, $revenue($depts['academy']));
        $this->assertSame(2000.0, $revenue($depts['agency']));
        $this->assertSame(0.0, $revenue($depts['studio']));
    }

    public function test_agency_without_the_target_department_keeps_the_sale_in_agency(): void
    {
        $agency = $this->agency();
        $depts = $this->departments($agency, ['agency']);
        $sale = $this->directSale($agency, [['service_id' => $this->service('Store')->id, 'line_total' => 5000]]);

        $this->assertSame($depts['agency']->id, app(DepartmentLedger::class)->departmentForInvoice($sale));
        $this->assertSame(5000.0, app(FinancialMetricsService::class)
            ->summary(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03 23:59:59'), [$agency->id], false, null, $depts['agency'])['ca']);
    }

    public function test_reassign_command_moves_legacy_income_to_the_store(): void
    {
        $agency = $this->agency();
        $depts = $this->departments($agency, ['agency', 'store']);
        $sale = $this->directSale($agency, [['service_id' => $this->service('Store')->id, 'line_total' => 5000]]);

        $income = AccountingTransaction::create([
            'number' => app(AccountingService::class)->nextNumber(),
            'agency_id' => $agency->id,
            'department_id' => $depts['agency']->id, // ancien rattachement par défaut
            'type' => 'income',
            'label' => 'Vente livre',
            'reference' => $sale->number,
            'amount' => 5000,
            'invoice_id' => $sale->id,
            'transacted_at' => '2026-11-02 10:00:00',
        ]);

        $this->artisan('accounting:reassign-departments')->assertSuccessful();
        $this->assertSame($depts['agency']->id, $income->fresh()->department_id);

        $this->artisan('accounting:reassign-departments', ['--apply' => true])->assertSuccessful();
        $this->assertSame($depts['store']->id, $income->fresh()->department_id);
    }
}
