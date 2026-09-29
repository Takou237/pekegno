<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Country;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AccountingCategorySeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Modèle de facture imprimable : l'en-tête, les comptes de paiement et le
 * cachet viennent de l'entité du pays de l'agence.
 */
class InvoicePrintDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_detail_exposes_country_invoice_settings(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class, AccountingCategorySeeder::class]);
        Sanctum::actingAs(User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')]));

        $org = Organization::create(['name' => 'PEKEGNO GROUP', 'code' => 'PKG']);
        $country = Country::create(['organization_id' => $org->id, 'name' => 'Cameroun', 'code' => 'CMX', 'currency_code' => 'XAF']);

        $this->putJson('/api/countries/'.$country->id, [
            'invoice_settings' => [
                'company_name' => 'PEKEGNO Cameroun SARL',
                'header_lines' => "Douala – Makepe\nE-mail : services@pekegnodigital.com",
                'footer_lines' => 'NUI : MO82416997570A',
                'payment_accounts' => [['label' => 'Orange Money', 'details' => '#150*47*875570*Montant#', 'holder' => 'Pekegno Cameroun Sarl']],
            ],
        ])->assertOk();

        $agency = Agency::factory()->create(['country_id' => $country->id]);
        $invoice = $this->postJson('/api/invoices', [
            'agency_id' => $agency->id,
            'items' => [['label' => 'Audit comptable', 'unit_price' => 180000, 'quantity' => 1]],
        ])->assertCreated()->json();

        $this->getJson('/api/invoices/'.$invoice['id'])
            ->assertOk()
            ->assertJsonPath('print.issuer.company_name', 'PEKEGNO Cameroun SARL')
            ->assertJsonPath('print.issuer.footer_lines', 'NUI : MO82416997570A')
            ->assertJsonPath('print.issuer.payment_accounts.0.label', 'Orange Money')
            ->assertJsonPath('print.recipient.country', 'Cameroun')
            ->assertJsonCount(1, 'print.items');
    }
}
