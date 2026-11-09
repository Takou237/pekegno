<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\PaymentProof;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\TreasuryAccountProvisioner;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * T1.4 / T2.5 / B11 — chaque paiement entre dans la caisse de son mode de
 * paiement (C/O/M/B…), jamais sans caisse, à la date de réception de l'argent.
 */
class PaymentTreasuryRoutingTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $admin;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-03 10:00:00');

        $this->agency = Agency::factory()->create();
        $this->admin = User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function invoice(array $extra = []): Invoice
    {
        $this->seq++;

        return Invoice::create(array_merge([
            'number' => sprintf('PK-TRS-%03d', $this->seq),
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

    private function pay(Invoice $invoice, float $amount, string $method, ?string $accountId = null, ?string $receivedAt = null): InvoicePayment
    {
        app(PaymentService::class)->applyPayment($invoice, $amount, $method, false, $this->admin->id, $accountId, null, $receivedAt);

        return InvoicePayment::where('invoice_id', $invoice->id)->latest('created_at')->firstOrFail();
    }

    private function balance(string $code): float
    {
        return (float) TreasuryAccount::where('agency_id', $this->agency->id)->where('code', $code)->firstOrFail()->computed_balance;
    }

    public function test_each_payment_method_goes_to_its_own_cash_box(): void
    {
        app(TreasuryAccountProvisioner::class)->ensureForAgency($this->agency);

        // Exemple du cahier (Douala 02/11) : 145 000 en espèces, 405 000 en OM/MTN.
        $this->pay($this->invoice(['total_amount' => 145000]), 145000, 'cash');
        $this->pay($this->invoice(['total_amount' => 300000]), 300000, 'om');
        $this->pay($this->invoice(['total_amount' => 105000]), 105000, 'momo');

        $this->assertSame(145000.0, $this->balance('C'));
        $this->assertSame(300000.0, $this->balance('O'));
        $this->assertSame(105000.0, $this->balance('M'));
        $this->assertSame(0, InvoicePayment::whereNull('treasury_account_id')->count());
    }

    public function test_missing_standard_cash_box_is_created_with_restricted_visibility(): void
    {
        $this->assertSame(0, TreasuryAccount::count());

        $payment = $this->pay($this->invoice(), 50000, 'om');

        $orange = TreasuryAccount::where('agency_id', $this->agency->id)->where('code', 'O')->firstOrFail();
        $this->assertSame($orange->id, $payment->treasury_account_id);
        $this->assertSame('mobile_money', $orange->type);
        $this->assertSame(TreasuryAccountProvisioner::RESTRICTED_ROLES, $orange->visible_roles);
        // Pas de repli silencieux sur une caisse espèces (constat F3).
        $this->assertFalse(TreasuryAccount::where('code', 'C')->exists());
    }

    public function test_mobile_payment_never_falls_back_to_the_cash_box(): void
    {
        $cash = app(TreasuryAccountProvisioner::class)->ensureAccount($this->agency, 'C');

        $payment = $this->pay($this->invoice(), 50000, 'momo');

        $this->assertNotSame($cash->id, $payment->treasury_account_id);
        $this->assertSame(0.0, (float) $cash->fresh()->computed_balance);
    }

    public function test_explicit_account_must_match_the_payment_method(): void
    {
        $cash = app(TreasuryAccountProvisioner::class)->ensureAccount($this->agency, 'C');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('ne correspond pas au mode de paiement');

        $this->pay($this->invoice(), 50000, 'om', $cash->id);
    }

    public function test_explicit_account_of_another_agency_is_refused(): void
    {
        $other = app(TreasuryAccountProvisioner::class)->ensureAccount(Agency::factory()->create(), 'C');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage("n'appartient pas à l'agence");

        $this->pay($this->invoice(), 50000, 'cash', $other->id);
    }

    public function test_generic_mobile_method_is_refused_when_ambiguous(): void
    {
        app(TreasuryAccountProvisioner::class)->ensureForAgency($this->agency);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Précisez le mode de paiement mobile');

        $this->pay($this->invoice(), 50000, 'mobile');
    }

    public function test_cash_box_movement_and_accounting_use_the_reception_date(): void
    {
        $payment = $this->pay($this->invoice(), 50000, 'cash', null, '2026-11-02 09:30:00');

        $this->assertSame('2026-11-02 09:30:00', $payment->received_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-11-03', $payment->validated_at->toDateString());

        $movement = TreasuryTransaction::where('source_id', $payment->id)->firstOrFail();
        $this->assertSame('2026-11-02', $movement->transacted_at->toDateString());

        $this->assertDatabaseHas('accounting_transactions', [
            'invoice_id' => $payment->invoice_id,
            'type' => 'income',
            'transacted_at' => '2026-11-02 09:30:00',
        ]);
    }

    public function test_future_reception_date_is_refused(): void
    {
        $this->expectException(HttpException::class);

        $this->pay($this->invoice(), 50000, 'cash', null, '2026-11-05 08:00:00');
    }

    public function test_accepting_a_proof_dates_the_payment_on_proof_submission(): void
    {
        // Yaoundé (B11) : preuve déposée le 02/11, validée par la caissière le 03/11.
        $invoice = $this->invoice([
            'validation_status' => Invoice::VALIDATION_PENDING,
            'declared_advance' => 40000,
            'payment_type' => 'om',
        ]);

        Carbon::setTestNow('2026-11-02 17:45:00');
        $proof = PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $this->admin->id,
            'payment_method' => 'om',
            'file_path' => 'payment-proofs/test.jpg',
            'status' => PaymentProof::STATUS_PENDING,
        ]);

        Carbon::setTestNow('2026-11-03 08:10:00');
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/payment-proofs/{$proof->id}/approve")->assertOk();

        $payment = InvoicePayment::where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertSame('2026-11-02 17:45:00', $payment->received_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-11-03', $payment->validated_at->toDateString());

        $orange = TreasuryAccount::where('agency_id', $this->agency->id)->where('code', 'O')->firstOrFail();
        $this->assertSame($orange->id, $payment->treasury_account_id);
        $this->assertSame('2026-11-02', TreasuryTransaction::where('source_id', $payment->id)->firstOrFail()->transacted_at->toDateString());
    }

    public function test_cancelling_an_invoice_takes_the_money_out_of_the_cash_box(): void
    {
        $invoice = $this->invoice();
        $this->pay($invoice, 30000, 'cash');
        $this->assertSame(30000.0, $this->balance('C'));

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/invoices/{$invoice->id}/cancel", ['cancellation_reason' => 'Doublon'])->assertOk();

        $this->assertSame(0.0, $this->balance('C'));
        $this->assertSame(1, TreasuryTransaction::where('source_type', 'invoice_payment_cancel')->count());
    }

    public function test_backfill_command_attaches_legacy_payments_to_their_cash_box(): void
    {
        $invoice = $this->invoice(['amount_paid' => 70000, 'status' => 'partial']);
        $cashPayment = InvoicePayment::create(['invoice_id' => $invoice->id, 'amount' => 20000, 'payment_method' => 'cash', 'paid_at' => '2026-11-02 08:00:00']);
        $omPayment = InvoicePayment::create(['invoice_id' => $invoice->id, 'amount' => 30000, 'payment_method' => 'om', 'paid_at' => '2026-11-02 09:00:00']);
        $ambiguous = InvoicePayment::create(['invoice_id' => $invoice->id, 'amount' => 20000, 'payment_method' => 'mobile', 'paid_at' => '2026-11-02 10:00:00']);

        // Simulation : rien n'est écrit.
        $this->artisan('treasury:backfill-payments')->assertSuccessful();
        $this->assertSame(0, TreasuryAccount::count());
        $this->assertNull($cashPayment->fresh()->treasury_account_id);

        $this->artisan('treasury:backfill-payments', ['--apply' => true])->assertSuccessful();

        $this->assertSame(4, TreasuryAccount::where('agency_id', $this->agency->id)->count());
        $this->assertSame(20000.0, $this->balance('C'));
        $this->assertSame(30000.0, $this->balance('O'));
        $this->assertNotNull($omPayment->fresh()->treasury_account_id);
        // « mobile » générique : signalé en anomalie, pas affecté au hasard.
        $this->assertNull($ambiguous->fresh()->treasury_account_id);

        // Rejouable : aucun mouvement en double.
        $this->artisan('treasury:backfill-payments', ['--apply' => true])->assertSuccessful();
        $this->assertSame(2, TreasuryTransaction::where('source_type', 'invoice_payment')->count());
    }

    public function test_backfill_takes_reception_date_from_the_accepted_proof(): void
    {
        $invoice = $this->invoice(['amount_paid' => 40000, 'status' => 'partial']);

        Carbon::setTestNow('2026-11-02 17:45:00');
        PaymentProof::create([
            'invoice_id' => $invoice->id,
            'submitted_by' => $this->admin->id,
            'payment_method' => 'cash',
            'file_path' => 'payment-proofs/test.jpg',
            'status' => PaymentProof::STATUS_ACCEPTED,
            'reviewed_by' => $this->admin->id,
            'reviewed_at' => '2026-11-03 08:10:00',
        ]);
        Carbon::setTestNow('2026-11-03 10:00:00');

        // Ancien comportement : paiement daté de la validation.
        $payment = InvoicePayment::create(['invoice_id' => $invoice->id, 'amount' => 40000, 'payment_method' => 'cash', 'paid_at' => '2026-11-03 08:10:02']);

        $this->artisan('treasury:backfill-payments', ['--apply' => true])->assertSuccessful();

        $this->assertSame('2026-11-02 17:45:00', $payment->fresh()->received_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-11-02', TreasuryTransaction::where('source_id', $payment->id)->first()->transacted_at->toDateString());
    }
}
