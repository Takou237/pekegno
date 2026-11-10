<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Service;
use App\Services\CatalogRevenueService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * B24 — la branche d'un article est stockée sur l'article et sert de source
 * unique au Store, au suivi des ventes et à la comptabilité par élément.
 */
class ProductBranchTest extends TestCase
{
    use RefreshDatabase;

    public function test_branch_is_persisted_from_article_or_category(): void
    {
        $academy = Category::factory()->create(['name' => 'academy']);
        $books = Category::factory()->create(['name' => 'Livre']);

        $academyProduct = Product::factory()->create(['category_id' => $academy->id]);
        $bookProduct = Product::factory()->create(['category_id' => $books->id]);
        $studioService = Service::factory()->create([
            'category_id' => $academy->id,
            'branch' => 'studio',
        ]);
        $bookService = Service::factory()->create(['category_id' => $books->id]);

        $this->assertSame('academy', $academyProduct->fresh()->branch);
        $this->assertSame(Product::DEFAULT_BRANCH, $bookProduct->fresh()->branch);
        $this->assertSame('studio', $studioService->fresh()->branch);
        $this->assertSame(Service::DEFAULT_BRANCH, $bookService->fresh()->branch);
    }

    public function test_catalog_revenue_exposes_branch_per_item_and_in_totals(): void
    {
        $academy = Category::factory()->create(['name' => 'academy']);
        $books = Category::factory()->create(['name' => 'Livre']);

        $academyProduct = Product::factory()->create(['category_id' => $academy->id, 'name' => 'Cours']);
        $bookProduct = Product::factory()->create(['category_id' => $books->id, 'name' => 'Livre']);
        $studioService = Service::factory()->create([
            'category_id' => $books->id,
            'branch' => 'studio',
            'name' => 'Coaching',
        ]);

        $report = app(CatalogRevenueService::class)
            ->report(now()->startOfMonth(), now()->endOfMonth(), null);

        $rows = collect($report['rows'])->keyBy('key');

        $this->assertSame('academy', $rows["product:{$academyProduct->id}"]['branch']);
        $this->assertSame('store', $rows["product:{$bookProduct->id}"]['branch']);
        $this->assertSame('studio', $rows["service:{$studioService->id}"]['branch']);

        foreach (['academy', 'store', 'studio'] as $branch) {
            $this->assertArrayHasKey($branch, $report['totals']['by_branch']);
        }
    }
}
