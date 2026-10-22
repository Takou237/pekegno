<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Comptabilité par produit (onglet du caissier) : tout le catalogue, avec les
 * encaissements répartis par élément et par moyen de paiement.
 */
class CatalogRevenueTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_sees_whole_catalog_with_collections_by_payment_method(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $agency = Agency::factory()->create();
        $otherAgency = Agency::factory()->create();

        $cashier = User::factory()->create(['role_id' => Role::where('name', 'caissier')->value('id')]);
        $cashier->assignments()->sync([$agency->id => ['is_primary' => false]]);

        $book = Product::factory()->create(['name' => 'Livre', 'selling_price' => 6000, 'agency_id' => null]);
        $audit = Service::factory()->create(['name' => 'Audit', 'price' => 14000, 'agency_id' => null]);
        Product::factory()->create(['name' => 'Autre agence', 'agency_id' => $otherAgency->id]);

        $invoice = Invoice::create([
            'number' => 'FAC-1', 'agency_id' => $agency->id, 'client_name' => 'Client', 'invoice_date' => now(),
            'payment_type' => 'cash', 'total_amount' => 20000, 'amount_paid' => 20000, 'discount' => 0, 'vat_rate' => 0,
            'status' => 'paid', 'validation_status' => 'validated',
        ]);
        $invoice->items()->create(['product_id' => $book->id, 'label' => 'Livre', 'unit_price' => 6000, 'quantity' => 1, 'line_total' => 6000]);
        $invoice->items()->create(['service_id' => $audit->id, 'label' => 'Audit', 'unit_price' => 14000, 'quantity' => 1, 'line_total' => 14000]);
        $invoice->payments()->create(['amount' => 10000, 'payment_method' => 'cash', 'is_advance' => true, 'paid_at' => now(), 'received_by' => $cashier->id]);
        $invoice->payments()->create(['amount' => 10000, 'payment_method' => 'om', 'is_advance' => false, 'paid_at' => now(), 'received_by' => $cashier->id]);

        // Créé après coup, sans vente : apparaît quand même.
        $fresh = Product::factory()->create(['name' => 'Nouveau produit', 'agency_id' => $agency->id]);

        Sanctum::actingAs($cashier);
        $data = $this->getJson('/api/accounting/catalog-revenue?from='.now()->toDateString().'&to='.now()->toDateString())
            ->assertOk()
            ->json();

        $rows = collect($data['rows'])->keyBy('key');
        $this->assertTrue($rows->has("product:{$fresh->id}"));
        $this->assertSame(0, $rows["product:{$fresh->id}"]['quantity']);
        $this->assertFalse($rows->contains('name', 'Autre agence'), 'Catalogue d\'une autre agence exclu.');

        // 20 000 encaissés (10 000 espèces + 10 000 OM) répartis 30 % / 70 %.
        $this->assertEquals(6000, $rows["product:{$book->id}"]['collected']);
        $this->assertEquals(3000, $rows["product:{$book->id}"]['by_mode']['cash']);
        $this->assertEquals(3000, $rows["product:{$book->id}"]['by_mode']['om']);
        $this->assertEquals(14000, $rows["service:{$audit->id}"]['collected']);
        $this->assertEquals(20000, $data['totals']['collected']);
        $this->assertEquals(10000, $data['totals']['by_mode']['om']);
    }
}
