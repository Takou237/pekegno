<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Services\BilanService;
use App\Services\FinancialMetricsService;
use App\Services\PaymentService;
use App\Services\TreasuryAccountProvisioner;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Bugs P1 du cahier traités le 08/11 : B4 / B24 (catégorie et branche des
 * lignes), B8 (aucune facture ne disparaît), B14 (devises), B15 (base du
 * taux de recouvrement), B16 (CA d'un commercial dans l'agence de la facture).
 */
class CorrectionsP1Test extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-03 10:00:00');
        $this->admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
        Sanctum::actingAs($this->admin);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function agency(?Country $country = null): Agency
    {
        $agency = Agency::factory()->create(['country_id' => $country?->id]);
        app(TreasuryAccountProvisioner::class)->ensureForAgency($agency);

        return $agency;
    }

    private function invoice(Agency $agency, float $total, array $lines, array $extra = []): Invoice
    {
        $this->seq++;
        $invoice = Invoice::create(array_merge([
            'number' => sprintf('PK-P1-%03d', $this->seq),
            'agency_id' => $agency->id,
            'invoice_date' => '2026-11-02',
            'total_amount' => $total,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ], $extra));
        foreach ($lines as $line) {
            $invoice->items()->create($line + ['label' => 'Ligne', 'quantity' => 1, 'unit_price' => $line['line_total']]);
        }

        return $invoice;
    }

    private function service(string $category): Service
    {
        $this->seq++;

        return Service::create([
            'code' => 'SRV-P1-'.$this->seq,
            'name' => 'Livre '.$this->seq,
            'price' => 1000,
            'category_id' => Category::firstOrCreate(['name' => $category])->id,
        ]);
    }

    private function enroll(Invoice $invoice): void
    {
        FormationEnrollment::create([
            'course_id' => Course::factory()->create()->id,
            'learner_user_id' => User::factory()->create()->id,
            'invoice_id' => $invoice->id,
            'enrolled_at' => now(),
            'status' => 'active',
        ]);
    }

    // --- B4 / B24 ------------------------------------------------------------------

    public function test_sales_by_category_add_up_to_revenue_and_classify_each_line(): void
    {
        $agency = $this->agency();
        // Inscription (ligne libre) : 100 000 avec 10 000 de remise.
        $this->enroll($this->invoice($agency, 90000, [['line_total' => 100000]]));
        // Livre du catalogue Store.
        $this->invoice($agency, 5000, [['service_id' => $this->service('Livre')->id, 'line_total' => 5000]]);
        // Ligne libre hors inscription + budget pub client (exclu du CA).
        $this->invoice($agency, 50000, [['line_total' => 20000], ['line_total' => 30000, 'is_pass_through' => true]]);

        $metrics = app(FinancialMetricsService::class);
        $period = [Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03 23:59:59')];
        $byCategory = $metrics->byCategory(...$period)->keyBy('name');

        $this->assertSame(115000.0, $metrics->summary(...$period)['ca']);
        $this->assertSame(115000.0, (float) $byCategory->sum('total'));
        $this->assertSame(90000.0, $byCategory['Academy']['total']);
        $this->assertSame('academy', $byCategory['Academy']['branch']);
        $this->assertSame(5000.0, $byCategory['Livre']['total']);
        $this->assertSame('store', $byCategory['Livre']['branch']);
        $this->assertSame(20000.0, $byCategory['Sans catégorie']['total']);

        // Même chiffre sur l'endpoint du tableau de bord.
        $api = collect($this->getJson('/api/stats/sales-by-category?from=2026-11-01&to=2026-11-03')->assertOk()->json());
        $this->assertSame(115000.0, (float) $api->sum('revenue'));
    }

    public function test_sales_tracking_classifies_a_book_as_store_like_the_dashboard(): void
    {
        $agency = $this->agency();
        $this->invoice($agency, 5000, [['service_id' => $this->service('Livre')->id, 'line_total' => 5000, 'label' => 'Livre']]);
        $this->enroll($this->invoice($agency, 50000, [['line_total' => 50000, 'label' => 'Formation']]));

        $rows = collect($this->getJson('/api/sales-tracking?from=2026-11-01&to=2026-11-03')->assertOk()->json('data'))->keyBy('activity');

        $this->assertSame('store', $rows['Livre']['type']);
        $this->assertSame('academy', $rows['Formation']['type']);

        $store = $this->getJson('/api/sales-tracking?from=2026-11-01&to=2026-11-03&type=store')->assertOk()->json('data');
        $this->assertSame(['Livre'], collect($store)->pluck('activity')->all());
    }

    // --- Lot 3 : une rubrique par catégorie du catalogue -------------------------------

    public function test_rubrics_are_academy_agency_seminar_and_each_catalog_category(): void
    {
        $agency = $this->agency();
        Category::firstOrCreate(['name' => 'Goodies']); // créée, encore jamais vendue
        $pay = fn (Invoice $i, float $amount) => app(PaymentService::class)
            ->applyPayment($i, $amount, 'cash', false, $this->admin->id, null, '2026-11-02 09:00:00');

        $formation = $this->invoice($agency, 50000, [['line_total' => 50000]]);
        $this->enroll($formation);
        $pay($formation, 50000);
        // Même facture : un livre et un abonnement Canva, payés en entier.
        $store = $this->invoice($agency, 8000, [
            ['service_id' => $this->service('Livre')->id, 'line_total' => 5000],
            ['service_id' => $this->service('Canva')->id, 'line_total' => 3000],
        ]);
        $pay($store, 8000);
        // Service séminaire (Pass) rangé dans la catégorie Livre : rubrique Séminaire.
        $pass = $this->service('Livre');
        $pass->update(['is_seminar' => true]);
        $seminar = $this->invoice($agency, 20000, [['service_id' => $pass->id, 'line_total' => 20000]]);
        $pay($seminar, 20000);

        // Comptabilité : recettes par rubrique, total = recettes.
        $res = $this->getJson('/api/accounting/transactions?from=2026-11-02&to=2026-11-02')->assertOk();
        $rubrics = collect($res->json('income_by_rubric'))->keyBy('rubric');
        $this->assertEqualsWithDelta(78000.0, (float) $res->json('totals.income'), 0.01);
        $this->assertEqualsWithDelta(78000.0, $rubrics->sum('total'), 0.01);
        $this->assertEqualsWithDelta(20000.0, $rubrics['Séminaire']['total'], 0.01);
        $this->assertSame('store', $rubrics['Séminaire']['branch']);
        $this->assertSame(0.0, (float) $rubrics['Agency']['total']);
        $this->assertArrayNotHasKey('Formations', $rubrics->all());
        $this->assertEqualsWithDelta(50000.0, $rubrics['Academy']['total'], 0.01);
        $this->assertSame('academy', $rubrics['Academy']['branch']);
        $this->assertEqualsWithDelta(5000.0, $rubrics['Livre']['total'], 0.01);
        $this->assertSame('store', $rubrics['Livre']['branch']);
        $this->assertEqualsWithDelta(3000.0, $rubrics['Canva']['total'], 0.01);
        $this->assertSame('store', $rubrics['Canva']['branch']);
        $this->assertSame(0.0, (float) $rubrics['Goodies']['total']);

        // Bilan du jour : une ligne par catégorie, et chaque catégorie du
        // catalogue fournie pour sa colonne (même à zéro).
        $day = app(BilanService::class)->daily(Carbon::parse('2026-11-02'), $agency->id);
        $byCategory = collect($day['services_by_category'])->groupBy('category')->map->sum('total');
        $this->assertEqualsWithDelta(5000.0, $byCategory['Livre'], 0.01);
        $this->assertEqualsWithDelta(3000.0, $byCategory['Canva'], 0.01);
        $this->assertEqualsWithDelta(20000.0, $byCategory['Séminaire'], 0.01);
        $this->assertEqualsWithDelta(50000.0, $day['formation_total'], 0.01);

        $period = app(BilanService::class)->period(Carbon::parse('2026-11-02'), Carbon::parse('2026-11-02'), $agency->id);
        $this->assertContains('Goodies', $period['sale_categories']);
        $this->assertContains('Séminaire', $period['sale_categories']);
    }

    // --- B8 ------------------------------------------------------------------------

    public function test_rejected_and_cancelled_invoices_stay_findable(): void
    {
        $agency = $this->agency();
        $rejected = $this->invoice($agency, 10000, [['line_total' => 10000]], ['validation_status' => Invoice::VALIDATION_REJECTED]);
        $cancelled = $this->invoice($agency, 20000, [['line_total' => 20000]], ['cancelled_at' => now(), 'status' => 'paid']);

        $default = collect($this->getJson('/api/invoices')->assertOk()->json('invoices.data'))->pluck('number');
        $this->assertContains($rejected->number, $default);
        $this->assertNotContains($cancelled->number, $default);

        // Filtre « Annulée » : il renvoyait toujours une liste vide.
        $onlyCancelled = collect($this->getJson('/api/invoices?status=cancelled')->assertOk()->json('invoices.data'))->pluck('number');
        $this->assertSame([$cancelled->number], $onlyCancelled->all());
    }

    public function test_client_removing_a_rejected_invoice_cancels_it_instead_of_deleting(): void
    {
        $client = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);
        $invoice = $this->invoice($this->agency(), 10000, [['line_total' => 10000]], [
            'client_id' => $client->id, 'validation_status' => Invoice::VALIDATION_REJECTED,
        ]);
        $token = $client->createToken('client-token', ['*'])->plainTextToken;
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->deleteJson("/api/client/invoices/{$invoice->id}")->assertOk();

        $kept = Invoice::find($invoice->id);
        $this->assertNotNull($kept);
        $this->assertNotNull($kept->cancelled_at);
        $this->assertSame(1, $kept->items()->count());
        $this->assertDatabaseHas('activity_logs', ['entity_id' => $invoice->id, 'action' => 'cancelled']);
        $this->assertSame([], $this->withToken($token)->getJson('/api/client/invoices')->assertOk()->json('data'));
    }

    public function test_deleting_an_enrollment_logs_the_invoice_cancellation(): void
    {
        $invoice = $this->invoice($this->agency(), 50000, [['line_total' => 50000]]);
        $this->enroll($invoice);
        $enrollment = FormationEnrollment::where('invoice_id', $invoice->id)->firstOrFail();

        $this->deleteJson("/api/formation-enrollments/{$enrollment->id}")->assertNoContent();

        $this->assertNotNull($invoice->fresh()->cancelled_at);
        $this->assertDatabaseHas('activity_logs', ['entity_id' => $invoice->id, 'action' => 'cancelled']);
    }

    // --- B14 -----------------------------------------------------------------------

    public function test_consolidated_bilan_converts_each_country_into_the_group_currency(): void
    {
        $cameroun = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF', 'exchange_rate' => 1, 'is_active' => true]);
        // Taux volontairement ≠ 1 pour voir la conversion (1 unité locale = 2 du groupe).
        $ivoire = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF', 'exchange_rate' => 2, 'is_active' => true]);
        $douala = $this->agency($cameroun);
        $abidjan = $this->agency($ivoire);
        $pay = fn (Agency $a, float $amount) => app(PaymentService::class)
            ->applyPayment($this->invoice($a, $amount, [['line_total' => $amount]]), $amount, 'cash', false, $this->admin->id, null, '2026-11-02 10:00:00');
        $pay($douala, 10000);
        $pay($abidjan, 5000);

        $consolidated = app(BilanService::class)->consolidated(Carbon::parse('2026-11-02'), [$douala->id, $abidjan->id]);
        $rows = collect($consolidated['agencies'])->keyBy('agency_id');

        // Chaque agence dans sa monnaie, le total dans celle du groupe.
        $this->assertSame('XOF', $rows[$abidjan->id]['currency_code']);
        $this->assertSame(5000.0, (float) $rows[$abidjan->id]['total_received']);
        $this->assertSame('XAF', $consolidated['currency_code']);
        $this->assertSame(20000.0, (float) $consolidated['totals']['total_encaisse']);

        // Vue groupe d'une journée : même conversion.
        $global = app(BilanService::class)->daily(Carbon::parse('2026-11-02'), null);
        $this->assertSame(20000.0, (float) $global['total_received']);

        // Suivi des ventes multi-pays : totaux convertis, lignes dans leur devise.
        $tracking = $this->getJson('/api/sales-tracking?from=2026-11-01&to=2026-11-03')->assertOk()->json();
        $this->assertSame('XAF', $tracking['totals']['currency_code']);
        $this->assertSame(20000.0, (float) $tracking['totals']['billed']);
        $this->assertContains('XOF', collect($tracking['data'])->pluck('currency_code')->all());
    }

    // --- B15 -----------------------------------------------------------------------

    public function test_recovery_rate_uses_the_collected_amount_of_the_period_invoices(): void
    {
        $agency = $this->agency();
        // Facture d'octobre réglée le 02/11 : un recouvrement, dans l'Encaissé.
        $old = $this->invoice($agency, 40000, [['line_total' => 40000]], ['invoice_date' => '2026-10-20']);
        app(PaymentService::class)->applyPayment($old, 40000, 'cash', false, $this->admin->id, null, '2026-11-02 09:00:00');
        // Facture du 02/11 : 100 000, 60 000 encaissés.
        $new = $this->invoice($agency, 100000, [['line_total' => 100000]]);
        app(PaymentService::class)->applyPayment($new, 60000, 'cash', true, $this->admin->id, null, '2026-11-02 10:00:00');

        $stats = $this->getJson('/api/stats/group?from=2026-11-01&to=2026-11-03')->assertOk()->json();

        $this->assertEquals(100000, $stats['payments_total']);
        $this->assertEquals(40000, $stats['recoveries_total']);
        $this->assertEquals(60000, $stats['collected_on_period_invoices']);
        // Encaissé − recouvrements = base du taux affichée sous la carte.
        $this->assertEquals($stats['payments_total'] - $stats['recoveries_total'], $stats['collected_on_period_invoices']);
        $this->assertEquals(60.0, $stats['collection_rate']);
    }

    // --- B16 -----------------------------------------------------------------------

    public function test_commercial_revenue_counts_in_the_agency_of_the_invoice(): void
    {
        $douala = $this->agency();
        $yaounde = $this->agency();
        $seller = Commercial::create(['agency_id' => $douala->id, 'kind' => 'commercial', 'first_name' => 'Awa', 'last_name' => 'K', 'email' => 'awa@example.com', 'is_active' => true]);
        $this->invoice($yaounde, 135000, [['line_total' => 135000]], ['commercial_id' => $seller->id]);

        $inYaounde = collect($this->getJson("/api/commercials/ranking?agency_id={$yaounde->id}")->assertOk()->json())->firstWhere('id', $seller->id);
        $this->assertNotNull($inYaounde);
        $this->assertEquals(135000, $inYaounde['turnover']);
        $this->assertEquals(1, $inYaounde['sales_count']);

        $inDouala = collect($this->getJson("/api/commercials/ranking?agency_id={$douala->id}")->assertOk()->json())->firstWhere('id', $seller->id);
        $this->assertEquals(0, $inDouala['turnover'] ?? 0);

        $byCommercial = app(FinancialMetricsService::class)
            ->byCommercial(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03 23:59:59'), [$yaounde->id])
            ->firstWhere('commercial_id', $seller->id);
        $this->assertSame(135000.0, (float) $byCommercial['revenue']);
    }
}
