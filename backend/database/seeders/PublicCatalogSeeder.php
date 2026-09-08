<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Catalogue public (site client) :
 * - Catégories de catalogue
 * - Services publics (is_public + slug), globaux ou par agence
 * - Produits publics (is_public + slug)
 * - Cours actifs (is_active) avec modules
 *
 * Idempotent : relançable sans doublon ni violation d'unicité.
 */
class PublicCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categories = $this->categories();

        $agencies = Agency::query()->orderBy('name')->get();
        if ($agencies->isEmpty()) {
            $this->command?->warn('Aucune agence trouvée : les éléments de catalogue seront globaux.');

            return;
        }

        $assign = fn (?int $index): ?string => $index === null ? null : $agencies->get($index)?->id;

        $this->seedServices($categories, $assign);
        $this->seedProducts($categories, $assign);
        $this->seedCourses($agencies);

        $this->command?->info(sprintf(
            'Catalogue public prêt : %d services, %d produits, %d formations.',
            Service::public()->count(),
            Product::public()->count(),
            Course::where('is_active', true)->count()
        ));
    }

    /**
     * @return array<string, Category>
     */
    private function categories(): array
    {
        $defs = [
            'Formations' => ['description' => 'Formations professionnelles certifiantes', 'color' => '#3B82F6', 'icon' => 'book'],
            'Conseil' => ['description' => 'Prestations de conseil', 'color' => '#10B981', 'icon' => 'briefcase'],
            'Audit' => ['description' => "Prestations d'audit", 'color' => '#F59E0B', 'icon' => 'clipboard'],
            'Boutique' => ['description' => 'Produits PEKEGNO', 'color' => '#8B5CF6', 'icon' => 'shopping-bag'],
        ];

        $categories = [];
        foreach ($defs as $name => $meta) {
            $categories[$name] = Category::updateOrCreate(
                ['name' => $name],
                $meta
            );
        }

        return $categories;
    }

    /**
     * @param  array<string, Category>  $categories
     * @param  callable(?int): ?string  $assign
     */
    private function seedServices(array $categories, callable $assign): void
    {
        $catalog = [
            ['name' => 'Formation Excel Avancé', 'category' => 'Formations', 'price' => 50000, 'agency_index' => null],
            ['name' => 'Formation Comptabilité', 'category' => 'Formations', 'price' => 75000, 'agency_index' => 0],
            ['name' => 'Formation Marketing Digital', 'category' => 'Formations', 'price' => 60000, 'agency_index' => 1],
            ['name' => 'Formation Gestion de Projet', 'category' => 'Formations', 'price' => 85000, 'agency_index' => 2],
            ['name' => 'Formation Communication Professionnelle', 'category' => 'Formations', 'price' => 55000, 'agency_index' => 0],
            ['name' => 'Formation RH & Paie', 'category' => 'Formations', 'price' => 90000, 'agency_index' => 1],
            ['name' => 'Conseil en organisation', 'category' => 'Conseil', 'price' => 120000, 'agency_index' => null],
            ['name' => 'Conseil stratégique', 'category' => 'Conseil', 'price' => 150000, 'agency_index' => 0],
            ['name' => 'Conseil digital', 'category' => 'Conseil', 'price' => 130000, 'agency_index' => 1],
            ['name' => 'Conseil juridique', 'category' => 'Conseil', 'price' => 140000, 'agency_index' => 2],
            ['name' => 'Audit comptable', 'category' => 'Audit', 'price' => 200000, 'agency_index' => null],
            ['name' => 'Audit fiscal', 'category' => 'Audit', 'price' => 220000, 'agency_index' => 0],
            ['name' => 'Audit social', 'category' => 'Audit', 'price' => 180000, 'agency_index' => 1],
        ];

        foreach ($catalog as $data) {
            $service = Service::updateOrCreate(
                ['name' => $data['name']],
                [
                    'code' => Service::generateCode(),
                    'agency_id' => $assign($data['agency_index']),
                    'category_id' => $categories[$data['category']]->id,
                    'description' => "Offre PEKEGNO : {$data['name']}.",
                    'price' => $data['price'],
                    'is_seminar' => false,
                    'is_public' => true,
                    'slug' => Str::slug($data['name']),
                ]
            );

            if (! PriceHistory::where('service_id', $service->id)->exists()) {
                PriceHistory::create([
                    'service_id' => $service->id,
                    'price' => $service->price,
                    'changed_at' => now(),
                ]);
            }
        }
    }

    /**
     * @param  array<string, Category>  $categories
     * @param  callable(?int): ?string  $assign
     */
    private function seedProducts(array $categories, callable $assign): void
    {
        $catalog = [
            ['sku' => 'PRD-10001', 'name' => 'Guide PEKEGNO de la PME', 'brand' => 'PEKEGNO', 'price' => 12000, 'agency_index' => null],
            ['sku' => 'PRD-10002', 'name' => 'Bloc-notes Entrepreneur', 'brand' => 'PEKEGNO', 'price' => 5000, 'agency_index' => 0],
            ['sku' => 'PRD-10003', 'name' => 'Pack démarrage (guide + bloc-notes)', 'brand' => 'PEKEGNO', 'price' => 16000, 'agency_index' => 1],
            ['sku' => 'PRD-10004', 'name' => 'Cahier de formation', 'brand' => 'PEKEGNO', 'price' => 3000, 'agency_index' => 2],
            ['sku' => 'PRD-10005', 'name' => 'T-shirt PEKEGNO', 'brand' => 'PEKEGNO', 'price' => 8000, 'agency_index' => null],
            ['sku' => 'PRD-10006', 'name' => 'Sac à dos professionnel', 'brand' => 'PEKEGNO', 'price' => 25000, 'agency_index' => 0],
            ['sku' => 'PRD-10007', 'name' => 'Stylo PEKEGNO', 'brand' => 'PEKEGNO', 'price' => 2000, 'agency_index' => 1],
            ['sku' => 'PRD-10008', 'name' => 'Agenda entrepreneur', 'brand' => 'PEKEGNO', 'price' => 15000, 'agency_index' => 2],
            ['sku' => 'PRD-10009', 'name' => 'Coffret cadeau PEKEGNO', 'brand' => 'PEKEGNO', 'price' => 30000, 'agency_index' => null],
        ];

        foreach ($catalog as $data) {
            $product = Product::updateOrCreate(
                ['slug' => Str::slug($data['name'])],
                [
                    'sku' => $data['sku'],
                    'name' => $data['name'],
                    'description' => "Produit PEKEGNO : {$data['name']}.",
                    'category_id' => $categories['Boutique']->id,
                    'brand' => $data['brand'],
                    'purchase_price' => (int) round($data['price'] * 0.6),
                    'selling_price' => $data['price'],
                    'tax_rate' => 19.25,
                    'is_stock_managed' => false,
                    'is_active' => true,
                    'is_public' => true,
                    'slug' => Str::slug($data['name']),
                    'agency_id' => $assign($data['agency_index']),
                ]
            );
        }
    }

    private function seedCourses($agencies): void
    {
        $courses = [
            ['code' => 'CRS-FRM-001', 'name' => 'Formation Excel Avancé', 'price' => 50000, 'agency_index' => null],
            ['code' => 'CRS-FRM-002', 'name' => 'Formation Comptabilité', 'price' => 75000, 'agency_index' => 0],
        ];

        foreach ($courses as $data) {
            $agencyId = $data['agency_index'] === null
                ? null
                : $agencies->get($data['agency_index'])?->id;

            $course = Course::updateOrCreate(
                ['code' => $data['code']],
                [
                    'name' => $data['name'],
                    'description' => "Formation certifiante : {$data['name']}.",
                    'price' => $data['price'],
                    'mode' => 'presentiel',
                    'duration_hours' => 12,
                    'duration_type' => 'hours',
                    'agency_id' => $agencyId,
                    'is_active' => true,
                ]
            );

            if ($course->modules()->count() === 0) {
                foreach ([1 => 'Module 1', 2 => 'Module 2'] as $order => $name) {
                    CourseModule::create([
                        'course_id' => $course->id,
                        'name' => $name,
                        'order_index' => $order,
                    ]);
                }
            }
        }
    }
}