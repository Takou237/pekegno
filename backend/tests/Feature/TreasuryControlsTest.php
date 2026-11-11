<?php

namespace Tests\Feature;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\CashClosing;
use App\Models\Invoice;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\FinancialMetricsService;
use App\Services\PaymentService;
use App\Services\TreasuryAccountProvisioner;
use App\Services\TreasuryService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Contrôles caisses / dépenses ajoutés le 07/11 (suite revue Lots 1–2) :
 *  - caisse obligatoire sur les dépenses saisies en Comptabilité (T1.4) ;
 *  - versements en banque = transferts, jamais des dépenses (B13, T2.7) ;
 *  - clôture en heure locale et validée par le chef d'agence (T2.9, T2.10) ;
 *  - « en attente de validation » inclut les preuves de reste à payer ;
 *  - scénario de réception « Douala 02/11 : caisse C = 381 000 puis 131 000 ».
 */
class TreasuryControlsTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-03 10:00:00');

        $this->agency = Agency::factory()->create();
        app(TreasuryAccountProvisioner::class)->ensureForAgency($this->agency);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role, bool $assign = true): User
    {
        $user = User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
        if ($assign) {
            $user->assignments()->sync([$this->agency->id => ['is_primary' => $role === 'responsable-agence']]);
        }

        return $user;
    }

    private function account(string $code): TreasuryAccount
    {
        return TreasuryAccount::where('agency_id', $this->agency->id)->where('code', $code)->firstOrFail();
    }

    private function category(string $name): AccountingCategory
    {
        return AccountingCategory::create(['name' => $name, 'type' => 'expense']);
    }

    private function invoice(array $extra = []): Invoice
    {
        $this->seq++;

        return Invoice::create(array_merge([
            'number' => sprintf('PK-CTL-%03d', $this->seq),
            'agency_id' => $this->agency->id,
            'invoice_date' => '2026-11-02',
            'total_amount' => 100000,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ], $extra));
    }

    // --- T1.4 : caisse obligatoire sur les dépenses manuelles -------------------

    public function test_manual_expense_requires_a_cash_box(): void
    {
        Sanctum::actingAs($this->user('super-admin', false));

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Carburant',
            'amount' => 24000,
            'agency_id' => $this->agency->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('treasury_account_id');
    }

    public function test_manual_expense_follows_its_cash_box_movement(): void
    {
        Sanctum::actingAs($this->user('super-admin', false));
        $cash = $this->account('C');

        $id = $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Carburant',
            'amount' => 24000,
            'treasury_account_id' => $cash->id,
            'transacted_at' => '2026-11-02',
        ])->assertCreated()->json('id');

        // Agence déduite de la caisse, sortie de caisse créée et datée.
        $this->assertSame($this->agency->id, AccountingTransaction::find($id)->agency_id);
        $this->assertSame(-24000.0, (float) $cash->fresh()->computed_balance);
        $movement = TreasuryTransaction::where('source_type', 'accounting_transaction')->where('source_id', $id)->firstOrFail();
        $this->assertSame('2026-11-02', $movement->transacted_at->toDateString());

        $this->putJson("/api/accounting/transactions/{$id}", ['amount' => 30000])->assertOk();
        $this->assertSame(-30000.0, (float) $cash->fresh()->computed_balance);

        $this->deleteJson("/api/accounting/transactions/{$id}")->assertNoContent();
        $this->assertSame(0.0, (float) $cash->fresh()->computed_balance);
    }

    public function test_cashier_cannot_spend_from_a_restricted_cash_box(): void
    {
        Sanctum::actingAs($this->user('caissier'));

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Achat',
            'amount' => 5000,
            'treasury_account_id' => $this->account('O')->id,
        ])->assertForbidden();
    }

    // --- B13 / T2.7 : versement en banque = transfert ---------------------------

    public function test_bank_deposit_cannot_be_entered_as_an_expense(): void
    {
        Sanctum::actingAs($this->user('super-admin', false));

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'label' => 'Versement à Afriland',
            'amount' => 222000,
            'category_id' => $this->category('VERSEMENT BANCAIRE')->id,
            'treasury_account_id' => $this->account('C')->id,
        ])->assertUnprocessable();
    }

    public function test_reclassify_command_turns_legacy_bank_deposits_into_transfers(): void
    {
        // Yaoundé 02/11 : 222 000 versés à la banque saisis en dépense, 89 000 de vraies dépenses.
        $deposit = AccountingTransaction::create([
            'number' => 1, 'agency_id' => $this->agency->id, 'type' => 'expense', 'amount' => 222000,
            'category_id' => $this->category('VERSEMENT BANCAIRE')->id, 'label' => 'Versement à Afriland',
            'transacted_at' => '2026-11-02 15:00:00',
        ]);
        AccountingTransaction::create([
            'number' => 2, 'agency_id' => $this->agency->id, 'type' => 'expense', 'amount' => 89000,
            'category_id' => $this->category('Fournitures')->id, 'label' => 'Fournitures',
            'transacted_at' => '2026-11-02 11:00:00',
        ]);

        $metrics = fn () => app(FinancialMetricsService::class)
            ->summary(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03 23:59:59'), [$this->agency->id]);
        $this->assertSame(311000.0, $metrics()['depenses']);

        $this->artisan('treasury:reclassify-transfers')->assertSuccessful();
        $this->assertFalse($deposit->fresh()->is_transfer);

        $this->artisan('treasury:reclassify-transfers', ['--apply' => true])->assertSuccessful();
        $this->artisan('treasury:reclassify-transfers', ['--apply' => true])->assertSuccessful();

        $this->assertTrue($deposit->fresh()->is_transfer);
        $this->assertSame(89000.0, $metrics()['depenses']);
        $this->assertSame(-222000.0, (float) $this->account('C')->computed_balance);
        $this->assertSame(222000.0, (float) $this->account('B')->computed_balance);
        $this->assertSame(2, TreasuryTransaction::where('transfer_type', 'bank_deposit')->count());
    }

    // --- T2.9 / T2.10 : clôture ---------------------------------------------------

    public function test_closing_ends_the_working_day_and_locks_the_cash_box(): void
    {
        $admin = $this->user('super-admin', false);
        $cash = $this->account('C');
        Carbon::setTestNow('2026-11-02 08:00:00');
        app(TreasuryService::class)->recordMovement($cash, 'in', 10000, 'Vente du matin');

        // 17:00 : la caissière finit sa journée.
        Carbon::setTestNow('2026-11-02 17:00:00');
        $cashier = $this->user('caissier');
        Sanctum::actingAs($cashier);
        $closing = $this->postJson('/api/treasury/closings', [
            'treasury_account_id' => $cash->id,
            'actual_balance' => 10000,
        ])->assertCreated()->json();
        $this->assertEquals(10000, $closing['theoretical_balance']);
        $this->assertTrue($this->getJson("/api/treasury/closings/day?treasury_account_id={$cash->id}")->json('is_closed'));

        // Caisse fermée : rien n'est encaissé, la facture reste en attente.
        Carbon::setTestNow('2026-11-02 18:00:00');
        $pending = $this->invoice(['validation_status' => Invoice::VALIDATION_PENDING, 'declared_advance' => 5000, 'payment_type' => 'cash']);
        Sanctum::actingAs($admin);
        $this->postJson("/api/invoices/{$pending->id}/validate")->assertStatus(422);
        $this->assertSame(Invoice::VALIDATION_PENDING, $pending->fresh()->validation_status);
        try {
            app(PaymentService::class)->applyPayment($this->invoice(), 2000, 'cash', false, $admin->id);
            $this->fail('Un paiement ne doit pas entrer dans une caisse clôturée.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }
        $this->assertSame(10000.0, (float) $cash->fresh()->computed_balance);

        // Réouverture le lendemain : nouvelle journée, solde initial = solde final.
        Carbon::setTestNow('2026-11-03 08:00:00');
        Sanctum::actingAs($cashier);
        $this->postJson("/api/treasury/accounts/{$cash->id}/reopen")->assertOk();
        // Paiement reçu la veille (avant la clôture) : il entre dans la journée en cours.
        app(PaymentService::class)->applyPayment($this->invoice(), 3000, 'cash', false, $admin->id, null, null, '2026-11-02 16:00:00');

        $day = $this->getJson("/api/treasury/closings/day?treasury_account_id={$cash->id}")->assertOk()->json();
        $this->assertFalse($day['is_closed']);
        $this->assertEquals(10000, $day['opening']);
        $this->assertEquals(3000, $day['in']);
        $this->assertEquals(13000, $day['closing']);
    }

    public function test_pending_validation_includes_pending_remaining_payment_proofs(): void
    {
        $this->invoice(['validation_status' => Invoice::VALIDATION_PENDING, 'declared_advance' => 30000]);
        $validated = $this->invoice();
        PaymentProof::create([
            'invoice_id' => $validated->id, 'submitted_by' => $this->user('commercial', false)->id,
            'payment_method' => 'om', 'amount' => 20000, 'file_path' => 'proofs/x.jpg',
            'status' => PaymentProof::STATUS_PENDING,
        ]);

        $summary = app(FinancialMetricsService::class)
            ->summary(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-03 23:59:59'), [$this->agency->id]);

        $this->assertSame(50000.0, $summary['en_attente_validation']);
    }

    // --- Contrôle de réception du cahier ------------------------------------------

    public function test_reception_check_douala_cash_box_on_november_2(): void
    {
        $admin = $this->user('super-admin', false);
        $c = $this->account('C');
        $c->update(['opening_balance' => 260000]);

        // 550 000 encaissés le 02/11 : 145 000 en espèces, 405 000 en OM et MTN.
        $pay = fn (float $amount, string $method) => app(PaymentService::class)->applyPayment(
            $this->invoice(['total_amount' => $amount]), $amount, $method, false, $admin->id, null, null, '2026-11-02 10:00:00');
        $pay(145000, 'cash');
        $pay(300000, 'om');
        $pay(105000, 'momo');

        // 24 000 de dépenses payées depuis la caisse C.
        Sanctum::actingAs($admin);
        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense', 'label' => 'Dépenses du jour', 'amount' => 24000,
            'treasury_account_id' => $c->id, 'transacted_at' => '2026-11-02 12:00:00',
        ])->assertCreated();

        $closing = app(\App\Services\CashClosingService::class);
        $this->assertSame(381000.0, $closing->theoreticalBalance($c->fresh(), '2026-11-02'));

        // Décaissement administratif de 250 000 : un transfert, pas une dépense.
        app(TreasuryService::class)->transfer($c->fresh(), $this->account('B'), 250000, 'Décaissement administratif', $admin->id, 'admin_disbursement');
        $this->assertSame(131000.0, (float) $c->fresh()->computed_balance);
        $this->assertSame(300000.0, (float) $this->account('O')->computed_balance);
        $this->assertSame(105000.0, (float) $this->account('M')->computed_balance);

        $summary = app(FinancialMetricsService::class)
            ->summary(Carbon::parse('2026-11-02'), Carbon::parse('2026-11-02 23:59:59'), [$this->agency->id]);
        $this->assertSame(550000.0, $summary['encaisse']);
        $this->assertSame(24000.0, $summary['depenses']);
    }

    // --- Cahier §2 : journée de caisse détaillée, transferts à part --------------

    public function test_cash_day_shows_in_out_and_transfers_separately(): void
    {
        $admin = $this->user('super-admin', false);
        Sanctum::actingAs($admin);
        Carbon::setTestNow('2026-11-02 15:00:00');
        $c = $this->account('C');
        $c->update(['opening_balance' => 260000]);

        $pay = fn (Invoice $invoice, float $amount, string $method) => app(PaymentService::class)->applyPayment(
            $invoice, $amount, $method, false, $admin->id, null, null, '2026-11-02 10:00:00');
        $pay($this->invoice(['total_amount' => 145000]), 145000, 'cash');
        $pay($this->invoice(['total_amount' => 300000]), 300000, 'om');
        $pay($this->invoice(['total_amount' => 105000]), 105000, 'momo');
        // Paiement espèces annulé le jour même : déduit des entrées, pas une sortie.
        $cancelled = $this->invoice(['total_amount' => 10000]);
        $pay($cancelled, 10000, 'cash');
        $this->postJson("/api/invoices/{$cancelled->id}/cancel", [
            'cancellation_reason' => 'Annulation de test',
        ])->assertOk();

        $this->postJson('/api/accounting/transactions', [
            'type' => 'expense', 'label' => 'Dépenses du jour', 'amount' => 24000,
            'treasury_account_id' => $c->id, 'transacted_at' => '2026-11-02 12:00:00',
        ])->assertCreated();

        $transfer = fn (string $from, string $to, float $amount, string $type) => $this->postJson('/api/treasury/transfer', [
            'from_account_id' => $this->account($from)->id, 'to_account_id' => $this->account($to)->id,
            'amount' => $amount, 'transfer_type' => $type,
        ]);
        $transfer('C', 'B', 250000, 'admin_disbursement')->assertOk();
        $transfer('O', 'B', 100000, 'bank_deposit')->assertOk();
        $transfer('M', 'C', 5000, 'withdrawal')->assertOk();

        // Sens interdits par le cahier.
        $transfer('B', 'C', 1000, 'withdrawal')->assertStatus(422);
        $transfer('O', 'C', 1000, 'bank_deposit')->assertStatus(422);
        $transfer('B', 'O', 1000, 'admin_disbursement')->assertStatus(422);

        $expected = ['opening' => 260000.0, 'in' => 145000.0, 'out' => 24000.0, 'transfer_in' => 5000.0, 'transfer_out' => 250000.0, 'closing' => 136000.0];

        // Clôture : même détail, et solde théorique = initial + entrées − sorties ± transferts.
        $this->assertSame($expected, app(\App\Services\CashClosingService::class)->dayBreakdown($c->fresh(), '2026-11-02'));
        $this->assertSame(136000.0, app(\App\Services\CashClosingService::class)->theoreticalBalance($c->fresh(), '2026-11-02'));
        // Écran Clôtures : journée en cours (aucune clôture encore) = même détail.
        $day = $this->getJson("/api/treasury/closings/day?treasury_account_id={$c->id}")->assertOk()->json();
        foreach ($expected as $key => $value) {
            $this->assertEquals($value, $day[$key], $key);
        }

        // Bilan du jour : mêmes colonnes par caisse.
        $rows = collect(app(\App\Services\BilanService::class)->daily(Carbon::parse('2026-11-02'), $this->agency->id)['treasury_accounts'])->keyBy('code');
        foreach ($expected as $key => $value) {
            $this->assertEquals($value, $rows['C'][$key === 'closing' ? 'closing' : $key], "C {$key}");
        }
        $this->assertEquals(350000, $rows['B']['transfer_in']);
        $this->assertEquals(300000, $rows['O']['in']);
        $this->assertEquals(100000, $rows['O']['transfer_out']);
        $this->assertEquals(5000, $rows['M']['transfer_out']);

        // Liste des mouvements : filtre « transferts seulement ».
        $this->assertSame(6, $this->getJson('/api/treasury/transactions?kind=transfer')->assertOk()->json('total'));
    }
}
