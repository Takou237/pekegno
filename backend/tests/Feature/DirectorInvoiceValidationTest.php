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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Le directeur général rattaché à un pays valide les factures en attente de
 * ce pays, et seulement celles-là.
 */
class DirectorInvoiceValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    private function pendingInvoice(Agency $agency): Invoice
    {
        return Invoice::create([
            'number' => 'FAC-'.uniqid(),
            'agency_id' => $agency->id,
            'client_name' => 'Client',
            'seller_user_id' => User::factory()->create(['role_id' => Role::where('name', 'super-admin')->value('id')])->id,
            'invoice_date' => now()->toDateString(),
            'payment_type' => 'cash',
            'total_amount' => 10000,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_PENDING,
        ]);
    }

    public function test_director_validates_only_invoices_of_their_country(): void
    {
        $cameroon = Country::create(['name' => 'Cameroun', 'code' => 'CMR', 'currency_code' => 'XAF', 'is_active' => true]);
        $ivoryCoast = Country::create(['name' => "Côte d'Ivoire", 'code' => 'CIV', 'currency_code' => 'XOF', 'is_active' => true]);
        $douala = Agency::factory()->create(['country_id' => $cameroon->id]);
        $abidjan = Agency::factory()->create(['country_id' => $ivoryCoast->id]);

        $director = User::factory()->create([
            'role_id' => Role::where('name', 'direction-generale')->value('id'),
            'country_id' => $cameroon->id,
        ]);
        Sanctum::actingAs($director);

        $own = $this->pendingInvoice($douala);
        $this->postJson("/api/invoices/{$own->id}/validate")->assertOk();
        $this->assertSame(Invoice::VALIDATION_VALIDATED, $own->fresh()->validation_status);

        $foreign = $this->pendingInvoice($abidjan);
        $this->postJson("/api/invoices/{$foreign->id}/validate")->assertNotFound();
        $this->assertSame(Invoice::VALIDATION_PENDING, $foreign->fresh()->validation_status);
    }
}
