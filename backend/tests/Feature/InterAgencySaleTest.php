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
use Illuminate\Http\UploadedFile;
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

    /** Preuve de paiement obligatoire pour une vente d'un chef d'agence (PNG 1×1, sans GD). */
    private function proof(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('preuve.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        ));
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
            'proof_file' => $this->proof(),
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
            'proof_file' => $this->proof(),
        ])->assertCreated()->json('id');

        // … et retrouve cette vente dans ses factures / créances (comme un
        // commercial) pour la modifier ou l'encaisser…
        $invoices = collect($this->getJson('/api/invoices?per_page=100')->assertOk()->json('invoices.data'));
        $this->assertTrue(
            $invoices->pluck('id')->contains($invoiceId),
            'Le chef doit voir ses propres ventes faites pour une autre agence.'
        );
        $this->getJson('/api/invoices/'.$invoiceId)->assertOk();

        // … mais pas les ventes des autres vendeurs de cette agence.
        $foreign = Invoice::create([
            'number' => 'TST-FOREIGN',
            'agency_id' => $this->yaounde->id,
            'seller_user_id' => User::factory()->create()->id,
            'invoice_date' => now(),
            'client_name' => 'Client Yaounde',
            'total_amount' => 10000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);
        $invoices = collect($this->getJson('/api/invoices?per_page=100')->assertOk()->json('invoices.data'));
        $this->assertFalse(
            $invoices->pluck('id')->contains($foreign->id),
            'La facture d\'un autre vendeur hors périmètre ne doit pas apparaître.'
        );
        $this->getJson('/api/invoices/'.$foreign->id)->assertNotFound();

        // Les autres listes de gestion restent limitées à son périmètre.
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

    public function test_my_sales_tab_lists_own_sales_across_agencies_only(): void
    {
        $client = User::factory()->create(['role_id' => Role::where('name', 'client')->value('id')]);
        $ownForeignId = $this->postJson('/api/invoices', [
            'agency_id' => $this->yaounde->id,
            'client_id' => $client->id,
            'payment_type' => 'cash',
            'advance' => 7500,
            'items' => [
                ['product_id' => $this->yaoundeProduct->id, 'unit_price' => 7500, 'quantity' => 1],
            ],
            'proof_file' => $this->proof(),
        ])->assertCreated()->json('id');

        // Vente d'un autre vendeur dans l'agence du chef : visible dans l'onglet
        // agence, pas dans « Mes ventes ».
        $colleague = Invoice::create([
            'number' => 'TST-DOUALA',
            'agency_id' => $this->douala->id,
            'seller_user_id' => User::factory()->create()->id,
            'invoice_date' => now(),
            'client_name' => 'Client Douala',
            'total_amount' => 10000,
            'amount_paid' => 0,
            'status' => 'unpaid',
            'validation_status' => Invoice::VALIDATION_VALIDATED,
        ]);

        $agencyTab = collect($this->getJson('/api/invoices?per_page=100&agency_id='.$this->douala->id)->assertOk()->json('invoices.data'))->pluck('id');
        $this->assertTrue($agencyTab->contains($colleague->id));
        $this->assertFalse($agencyTab->contains($ownForeignId), 'L\'onglet agence reste filtré sur l\'agence.');

        $mineTab = collect($this->getJson('/api/invoices?per_page=100&mine=1')->assertOk()->json('invoices.data'))->pluck('id');
        $this->assertTrue($mineTab->contains($ownForeignId), 'Mes ventes inclut la vente faite pour une autre agence.');
        $this->assertFalse($mineTab->contains($colleague->id), 'Mes ventes exclut les ventes des collègues.');
    }
}
