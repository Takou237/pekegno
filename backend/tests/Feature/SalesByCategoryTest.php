<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * B4 — « Ventes par catégorie ».
 *
 * La catégorie vient de la ligne de facture (repli service) et le montant est la
 * part encaissée, répartie au prorata. Les lignes sans catégorie restent
 * visibles sous « Sans catégorie » et ne dépassent jamais le facturé.
 */
class SalesByCategoryTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $this->agency = Agency::factory()->create();
    }

    private function invoice(string $number, float $total, float $paid, string $date = '2026-11-10'): Invoice
    {
        return Invoice::create([
            'number' => $number,
            'agency_id' => $this->agency->id,
            'invoice_date' => $date,
            'total_amount' => $total,
            'amount_paid' => $paid,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => $paid >= $total ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
            'validation_status' => Invoice::VALIDATION_VALIDATED,
            'source' => 'in_person',
        ]);
    }

    private function line(Invoice $invoice, string $label, float $amount, ?string $serviceId = null, ?string $categoryId = null): void
    {
        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'service_id' => $serviceId,
            'category_id' => $categoryId,
            'label' => $label,
            'unit_price' => $amount,
            'quantity' => 1,
            'line_total' => $amount,
            'is_pass_through' => false,
        ]);
    }

    public function test_category_comes_from_the_line_and_amounts_follow_revenue(): void
    {
        $academy = Category::factory()->create(['name' => 'Academy']);
        $agency = Category::factory()->create(['name' => 'Agency']);
        $formation = Service::factory()->create(['agency_id' => $this->agency->id, 'category_id' => $academy->id]);
        $prestation = Service::factory()->create(['agency_id' => $this->agency->id, 'category_id' => $agency->id]);

        // Facture partielle : 40 000 encaissés sur 100 000.
        $partial = $this->invoice('PK-B4-001', 100000, 40000);
        $this->line($partial, 'Formation', 60000, $formation->id);
        $this->line($partial, 'Prestation', 40000, $prestation->id);

        // Ligne libre (produit sans service) : catégorie inconnue.
        $free = $this->invoice('PK-B4-002', 30000, 30000);
        $this->line($free, 'Sacoche', 30000);

        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $rows = $this->getJson('/api/stats/sales-by-category?from=2026-11-01&to=2026-11-30')
            ->assertOk()
            ->json();

        $byCategory = collect($rows)->keyBy('category');

        // B4 : le CA facturé est réparti sur les lignes, comme la carte CA.
        $this->assertSame(60000.0, (float) $byCategory['Academy']['revenue']);
        $this->assertSame(40000.0, (float) $byCategory['Agency']['revenue']);
        $this->assertSame(30000.0, (float) $byCategory['Sans catégorie']['revenue']);

        // Total = CA facturé de la période.
        $this->assertSame(130000.0, (float) collect($rows)->sum('revenue'));
    }

    public function test_line_category_wins_over_the_service_category(): void
    {
        $serviceCategory = Category::factory()->create(['name' => 'Ancienne']);
        $lineCategory = Category::factory()->create(['name' => 'Nouvelle']);
        $service = Service::factory()->create([
            'agency_id' => $this->agency->id,
            'category_id' => $serviceCategory->id,
        ]);

        $invoice = $this->invoice('PK-B4-003', 50000, 50000);
        $this->line($invoice, 'Formation', 50000, $service->id, $lineCategory->id);

        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('name', 'super-admin')->value('id'),
        ]));

        $rows = collect($this->getJson('/api/stats/sales-by-category?from=2026-11-01&to=2026-11-30')
            ->assertOk()
            ->json())
            ->keyBy('category');

        $this->assertSame(50000.0, (float) $rows['Nouvelle']['revenue']);
        $this->assertArrayNotHasKey('Ancienne', $rows->all());
    }
}
