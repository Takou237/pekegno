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
}
