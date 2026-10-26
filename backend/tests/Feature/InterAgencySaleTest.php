<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Vente inter-agences : un chef d'agence de Douala établit une facture pour un
 * produit du catalogue de Yaoundé. Les rôles autorisés à vendre ne doivent pas
 * être bloqués par le périmètre d'agence, mais les listes de gestion, elles,
 * restent scopées.
 */
class InterAgencySaleTest extends TestCase
{
    use RefreshDatabase;

    private Agency $douala;

    private Agency $yaounde;

    private User $chief;

    private Product $yaoundeProduct;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->douala = Agency::factory()->create(['name' => 'Agence Douala']);
        $this->yaounde = Agency::factory()->create(['name' => 'Agence Yaounde']);

        $this->chief = User::factory()->create([
            'role_id' => Role::where('name', 'responsable-agence')->value('id'),
        ]);
        DB::table('user_assignments')->insert([
            'user_id' => $this->chief->id,
            'agency_id' => $this->douala->id,
            'is_primary' => true,
        ]);

        $this->yaoundeProduct = Product::factory()->create([
            'agency_id' => $this->yaounde->id,
            'name' => 'Ordinateur Yaounde',
            'selling_price' => 7500,
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->chief);
    }

    public function test_chief_can_open_another_agency_for_a_sale(): void
    {
        $this->getJson('/api/agencies/'.$this->yaounde->id)->assertOk();
    }

    public function test_product_search_for_sale_is_not_limited_to_the_seller_agency(): void
    {
        $results = $this->getJson('/api/products/search?q=Ordinateur&for_sale=1')
            ->assertOk()
            ->json();

        $found = collect($results)->firstWhere('id', $this->yaoundeProduct->id);

        $this->assertNotNull($found, 'Un vendeur doit retrouver les produits des autres agences.');
        $this->assertSame($this->yaounde->id, $found['agency_id']);
    }

    public function test_product_search_without_for_sale_stays_scoped_for_management(): void
    {
        $results = $this->getJson('/api/products/search?q=Ordinateur')
            ->assertOk()
            ->json();

        $this->assertNull(
            collect($results)->firstWhere('id', $this->yaoundeProduct->id),
            'La recherche de gestion reste limitée au périmètre de l\'utilisateur.'
        );
    }

    public function test_chief_can_create_an_invoice_for_a_foreign_agency_product(): void
    {
        $client = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);

        $this->postJson('/api/invoices', [
            'agency_id' => $this->yaounde->id,
            'client_id' => $client->id,
            'payment_type' => 'cash',
            'advance' => 7500,
            'items' => [
                ['product_id' => $this->yaoundeProduct->id, 'unit_price' => 7500, 'quantity' => 1],
            ],
        ])->assertCreated();

        $invoice = Invoice::latest('created_at')->firstOrFail();

        $this->assertSame(
            $this->yaounde->id,
            $invoice->agency_id,
            'La facture doit être rattachée à l\'agence du produit, pas à celle du vendeur.'
        );
    }

    public function test_management_lists_stay_scoped_to_the_chief_perimeter(): void
    {
        // Le chef facture une agence étrangère (vente autorisée)…
        $client = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);
        $invoiceId = $this->postJson('/api/invoices', [
            'agency_id' => $this->yaounde->id,
            'client_id' => $client->id,
            'payment_type' => 'cash',
            'advance' => 7500,
            'items' => [
                ['product_id' => $this->yaoundeProduct->id, 'unit_price' => 7500, 'quantity' => 1],
            ],
        ])->assertCreated()->json('id');

        // … mais les listes de gestion restent limitées à son périmètre.
        $invoices = collect($this->getJson('/api/invoices?per_page=100')->assertOk()->json('data'));
        $this->assertFalse(
            $invoices->pluck('id')->contains($invoiceId),
            'La facture d\'une agence hors périmètre ne doit pas apparaître dans la liste de gestion.'
        );
        $this->getJson('/api/invoices/'.$invoiceId)->assertNotFound();

        $products = collect($this->getJson('/api/products?per_page=100')->assertOk()->json('data'));
        $this->assertFalse(
            $products->pluck('id')->contains($this->yaoundeProduct->id),
            'La liste de gestion des produits reste scopée au périmètre.'
        );

        $agencies = collect($this->getJson('/api/agencies?per_page=100')->assertOk()->json('data'));
        $this->assertFalse(
            $agencies->pluck('id')->contains($this->yaounde->id),
            'La liste de gestion des agences reste scopée au périmètre.'
        );

        // Le sélecteur de vente, lui, doit rester complet (inter-agences).
        $saleAgencies = collect($this->getJson('/api/scope/agencies')->assertOk()->json('data'));
        $this->assertTrue($saleAgencies->pluck('id')->contains($this->yaounde->id));
    }
}
