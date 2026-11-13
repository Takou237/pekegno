<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\TreasuryAccount;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\TreasuryAccountProvisioner;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Une caisse = un moyen de paiement : créer une caisse ajoute le moyen de
 * paiement correspondant (formulaires, validation, routage du paiement, bilan).
 */
class CustomCashBoxPaymentMethodTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        Carbon::setTestNow('2026-11-13 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    public function test_creating_a_cash_box_creates_its_payment_method(): void
    {
        $agency = Agency::factory()->create();
        app(TreasuryAccountProvisioner::class)->ensureForAgency($agency);
        $this->assertSame('Caisse Espèces', TreasuryAccount::where('agency_id', $agency->id)->where('code', 'C')->value('name'));

        // Une caissière ne crée pas de caisse.
        Sanctum::actingAs($this->user('caissier'));
        $this->postJson('/api/treasury/accounts', ['agency_id' => $agency->id, 'name' => 'Airtel Money', 'type' => 'mobile_money'])->assertForbidden();

        $admin = $this->user('super-admin');
        Sanctum::actingAs($admin);
        $created = $this->postJson('/api/treasury/accounts', [
            'agency_id' => $agency->id, 'name' => 'Airtel Money', 'type' => 'mobile_money',
        ])->assertCreated()->json();
        $this->assertSame('airtel_money', $created['method_key']);
        $this->assertSame('AM', $created['code']);

        // Même caisse deux fois dans l'agence : refusé.
        $this->postJson('/api/treasury/accounts', ['agency_id' => $agency->id, 'name' => 'Airtel Money', 'type' => 'mobile_money'])->assertStatus(422);

        // Proposée dans les formulaires de l'agence (Espèces en premier).
        $methods = collect($this->getJson("/api/payment-methods?agency_id={$agency->id}")->assertOk()->json());
        $this->assertSame('cash', $methods->first()['key']);
        $this->assertSame('Espèces', $methods->first()['label']);
        $airtel = $methods->firstWhere('key', 'airtel_money');
        $this->assertSame('Airtel Money', $airtel['label']);
        $this->assertTrue($airtel['requires_phone']);

        // Une vente payée avec ce moyen va dans cette caisse et apparaît au bilan.
        $invoice = Invoice::create([
            'number' => 'PK-AIR-001', 'agency_id' => $agency->id, 'invoice_date' => '2026-11-13',
            'total_amount' => 40000, 'amount_paid' => 0, 'discount' => 0, 'vat_rate' => 0,
            'status' => 'unpaid', 'validation_status' => Invoice::VALIDATION_VALIDATED, 'source' => 'in_person',
        ]);
        app(PaymentService::class)->applyPayment($invoice, 40000, 'airtel_money', false, $admin->id);
        $payment = InvoicePayment::where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertSame($created['id'], $payment->treasury_account_id);

        $bilan = $this->getJson("/api/bilans?agency_id={$agency->id}&date=2026-11-13")->assertOk()->json();
        $line = collect($bilan['by_method'])->firstWhere('key', 'airtel_money');
        $this->assertSame('Airtel Money', $line['label']);
        $this->assertEquals(40000, $line['total']);
        $this->assertEquals(40000, $bilan['mobile_total'], 'rangé avec les paiements mobiles, pas en espèces');
        $this->assertEquals(0, $bilan['cash_total']);

        // Moyen inconnu : refusé à l'enregistrement d'un paiement.
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['amount' => 1000, 'payment_method' => 'inconnu'])
            ->assertStatus(422)->assertJsonValidationErrors('payment_method');

        // Désactivée : le moyen disparaît des formulaires.
        $this->putJson("/api/treasury/accounts/{$created['id']}", ['is_active' => false])->assertOk();
        $this->assertNull(collect($this->getJson("/api/payment-methods?agency_id={$agency->id}")->json())->firstWhere('key', 'airtel_money'));
    }

    public function test_a_payment_method_without_cash_box_in_the_agency_is_refused(): void
    {
        $douala = Agency::factory()->create();
        $yaounde = Agency::factory()->create();
        $admin = $this->user('super-admin');
        Sanctum::actingAs($admin);
        $this->postJson('/api/treasury/accounts', ['agency_id' => $douala->id, 'name' => 'Airtel Money', 'type' => 'mobile_money'])->assertCreated();

        $invoice = Invoice::create([
            'number' => 'PK-AIR-002', 'agency_id' => $yaounde->id, 'invoice_date' => '2026-11-13',
            'total_amount' => 10000, 'amount_paid' => 0, 'discount' => 0, 'vat_rate' => 0,
            'status' => 'unpaid', 'validation_status' => Invoice::VALIDATION_VALIDATED, 'source' => 'in_person',
        ]);

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        app(PaymentService::class)->applyPayment($invoice, 10000, 'airtel_money', false, $admin->id);
    }

    public function test_administration_roles_see_every_cash_box_and_manage_their_agency(): void
    {
        $douala = Agency::factory()->create();
        $yaounde = Agency::factory()->create();
        app(TreasuryAccountProvisioner::class)->ensureForAgency($douala);
        app(TreasuryAccountProvisioner::class)->ensureForAgency($yaounde);

        $assign = function (string $role, Agency $agency) {
            $u = $this->user($role);
            \Illuminate\Support\Facades\DB::table('user_assignments')->insert(['user_id' => $u->id, 'agency_id' => $agency->id, 'is_primary' => $role === 'responsable-agence']);

            return $u;
        };
        $chief = $assign('responsable-agence', $douala);
        $cashier = $assign('caissier', $douala);

        // Chef d'agence (administration) : toutes les caisses de son agence (C, O, M, B).
        Sanctum::actingAs($chief);
        $codes = collect($this->getJson("/api/treasury/accounts?agency_id={$douala->id}")->assertOk()->json())->pluck('code')->sort()->values()->all();
        $this->assertSame(['B', 'C', 'M', 'O'], $codes);

        // Caissière : seulement la caisse espèces (blocage serveur).
        Sanctum::actingAs($cashier);
        $this->assertSame(['C'], collect($this->getJson("/api/treasury/accounts?agency_id={$douala->id}")->assertOk()->json())->pluck('code')->all());

        // Le chef crée une caisse dans son agence, pas dans une autre.
        Sanctum::actingAs($chief);
        $this->postJson('/api/treasury/accounts', ['agency_id' => $douala->id, 'name' => 'Airtel Money', 'type' => 'mobile_money'])->assertCreated();
        $this->postJson('/api/treasury/accounts', ['agency_id' => $yaounde->id, 'name' => 'Airtel Money', 'type' => 'mobile_money'])->assertForbidden();
    }
}
