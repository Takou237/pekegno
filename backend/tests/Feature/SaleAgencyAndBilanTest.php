<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Course;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cas réel du 01/10/2026 : un admin (sans agence) inscrit un apprenant à une
 * formation globale (sans agence) avec un caissier comme vendeur. La facture
 * restait sans agence → absente du bilan du jour et de la caisse.
 */
class SaleAgencyAndBilanTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $cashier;

    private TreasuryAccount $cash;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->agency = Agency::factory()->create();
        $this->cash = TreasuryAccount::create([
            'agency_id' => $this->agency->id,
            'name' => 'Caisse',
            'type' => 'cash',
            'opening_balance' => 0,
            'is_active' => true,
        ]);
        $this->cashier = User::factory()->create(['role_id' => Role::where('name', 'caissier')->value('id')]);
        DB::table('user_assignments')->insert([
            'user_id' => $this->cashier->id,
            'agency_id' => $this->agency->id,
            'is_primary' => false,
            'is_department_chief' => false,
        ]);

        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
    }

    private function enrollInGlobalCourse(): Invoice
    {
        $course = Course::factory()->create(['agency_id' => null, 'price' => 50000]);
        $learner = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);

        $this->postJson('/api/formation-enrollments', [
            'course_id' => $course->id,
            'learner_user_id' => $learner->id,
            'seller_user_id' => $this->cashier->id,
            'amount_paid' => 10000,
            'payment_type' => 'cash',
        ])->assertCreated();

        return Invoice::latest('created_at')->firstOrFail();
    }

    public function test_global_course_enrollment_takes_the_seller_agency_and_reaches_the_cash_desk(): void
    {
        $invoice = $this->enrollInGlobalCourse();

        $this->assertSame($this->agency->id, $invoice->agency_id);
        $this->assertSame($this->cash->id, $invoice->payments()->first()->treasury_account_id);
        $this->assertTrue(TreasuryTransaction::where('treasury_account_id', $this->cash->id)->where('amount', 10000)->exists());
    }

    public function test_period_bilan_of_a_day_returns_that_day_with_its_evening_sales(): void
    {
        // 21:29 UTC = 22:29 à Douala, le 01/10.
        Carbon::setTestNow(Carbon::parse('2026-10-01 21:29:00', 'UTC'));
        $this->enrollInGlobalCourse();

        $days = $this->getJson("/api/bilans/period?from=2026-10-01&to=2026-10-01&agency_id={$this->agency->id}")
            ->assertOk()
            ->json('days');

        $this->assertCount(1, $days);
        $this->assertSame('2026-10-01', $days[0]['date']);
        $this->assertEquals(10000, $days[0]['total_received']);
        // Le bilan compte l'encaissé (10 000), pas le facturé (50 000).
        $this->assertEquals(10000, $days[0]['formation_total']);
        $this->assertEquals(10000, $days[0]['total_ventes_amount']);
        Carbon::setTestNow();
    }

    public function test_sales_columns_follow_payments_of_the_day_not_invoiced_amounts(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-01 10:00:00', 'UTC'));
        $invoice = $this->enrollInGlobalCourse(); // 50 000 facturés, 10 000 versés le 01/10

        Carbon::setTestNow(Carbon::parse('2026-10-02 10:00:00', 'UTC'));
        // Un jour plus tard : la déconnexion pour inactivité s'applique, on se reconnecte.
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['amount' => 15000, 'payment_method' => 'cash'])->assertSuccessful();

        $days = collect($this->getJson("/api/bilans/period?from=2026-10-01&to=2026-10-02&agency_id={$this->agency->id}")
            ->assertOk()->json('days'))->keyBy('date');

        foreach (['2026-10-01' => 10000, '2026-10-02' => 15000] as $date => $amount) {
            $this->assertEquals($amount, $days[$date]['formation_total'], $date);
            $this->assertEquals($amount, $days[$date]['total_ventes_amount'], $date);
            $this->assertEquals($amount, $days[$date]['total_received'], $date);
        }
        Carbon::setTestNow();
    }

    public function test_repair_command_attaches_orphan_invoices_and_their_payments(): void
    {
        $invoice = $this->enrollInGlobalCourse();
        // État d'avant le correctif : facture, écriture et versement sans agence ni caisse.
        $invoice->update(['agency_id' => null]);
        DB::table('accounting_transactions')->where('invoice_id', $invoice->id)->update(['agency_id' => null]);
        $invoice->payments()->update(['treasury_account_id' => null]);
        TreasuryTransaction::query()->delete();

        $this->artisan('invoices:repair-missing-agency')->assertSuccessful();
        $this->assertNull($invoice->fresh()->agency_id, 'la simulation ne doit rien modifier');

        $this->artisan('invoices:repair-missing-agency', ['--apply' => true])->assertSuccessful();
        $this->artisan('invoices:repair-missing-agency', ['--apply' => true])->assertSuccessful();

        $this->assertSame($this->agency->id, $invoice->fresh()->agency_id);
        $this->assertSame(0, DB::table('accounting_transactions')->where('invoice_id', $invoice->id)->whereNull('agency_id')->count());
        $this->assertSame($this->cash->id, $invoice->payments()->first()->treasury_account_id);
        $this->assertSame(1, TreasuryTransaction::where('source_type', 'invoice_payment')->count());
    }
}
