<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Country;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Périmètre factures du caissier (InvoiceController::scopeByRole).
 *
 * Une facture d'une autre agence du MÊME pays reste visible après validation :
 * bornée aux seules factures pending, elle sortait du périmètre au moment où le
 * caissier la validait et disparaissait de son onglet Factures (l'admin, non
 * soumis au cadrage, continuait de la voir).
 */
class CashierInvoiceScopeTest extends TestCase
{
    use RefreshDatabase;

    private Country $country;

    private Country $otherCountry;

    private Agency $assignedAgency;

    private Agency $siblingAgency;

    private Agency $foreignAgency;

    private User $cashier;

    private int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->country = Country::create(['name' => 'Cameroun', 'code' => 'CM', 'currency_code' => 'XAF']);
        $this->otherCountry = Country::create(['name' => "Cote d'Ivoire", 'code' => 'CI', 'currency_code' => 'XOF']);

        $this->assignedAgency = Agency::factory()->create(['country_id' => $this->country->id, 'country' => 'Cameroun']);
        $this->siblingAgency = Agency::factory()->create(['country_id' => $this->country->id, 'country' => 'Cameroun']);
        $this->foreignAgency = Agency::factory()->create(['country_id' => $this->otherCountry->id, 'country' => "Cote d'Ivoire"]);

        $this->cashier = User::factory()->create([
            'role_id' => Role::where('name', 'caissier')->value('id'),
            'country_id' => $this->country->id,
        ]);
        DB::table('user_assignments')->insert([
            'user_id' => $this->cashier->id,
            'agency_id' => $this->assignedAgency->id,
            'is_primary' => true,
        ]);
    }

    private function invoice(Agency $agency, string $validationStatus): Invoice
    {
        return Invoice::create([
            'number' => 'TST-'.(++$this->sequence),
            'agency_id' => $agency->id,
            'invoice_date' => now(),
            'client_name' => 'Client Test',
            'total_amount' => 10000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => $validationStatus,
        ]);
    }

    private function listedNumbers(): array
    {
        Sanctum::actingAs($this->cashier);

        return $this->getJson('/api/invoices?per_page=100')
            ->assertOk()
            ->json('invoices.data.*.number');
    }

    public function test_cashier_sees_validated_invoices_of_any_agency_in_his_country(): void
    {
        $assigned = $this->invoice($this->assignedAgency, Invoice::VALIDATION_VALIDATED);
        $sibling = $this->invoice($this->siblingAgency, Invoice::VALIDATION_VALIDATED);

        $numbers = $this->listedNumbers();

        $this->assertContains($assigned->number, $numbers, 'agence affectée');
        $this->assertContains($sibling->number, $numbers, 'facture validée d une autre agence du même pays');
    }

    public function test_cashier_keeps_seeing_a_sister_agency_invoice_after_validating_it(): void
    {
        $invoice = $this->invoice($this->siblingAgency, Invoice::VALIDATION_PENDING);

        $this->assertContains($invoice->number, $this->listedNumbers(), 'en attente');

        $invoice->update([
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'validated_at' => now(),
        ]);

        $this->assertContains($invoice->number, $this->listedNumbers(), 'validée : ne doit pas disparaître');
    }

    public function test_cashier_never_sees_invoices_of_another_country(): void
    {
        $pending = $this->invoice($this->foreignAgency, Invoice::VALIDATION_PENDING);
        $validated = $this->invoice($this->foreignAgency, Invoice::VALIDATION_VALIDATED);

        $numbers = $this->listedNumbers();

        $this->assertNotContains($pending->number, $numbers);
        $this->assertNotContains($validated->number, $numbers);
    }
}
