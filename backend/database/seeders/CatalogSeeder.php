<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Category;
use App\Models\PriceHistory;
use App\Models\Service;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Formations', 'description' => 'Formations présentiel et distanciel', 'color' => '#3B82F6', 'icon' => 'book'],
            ['name' => 'Conseil', 'description' => 'Prestations de conseil', 'color' => '#10B981', 'icon' => 'briefcase'],
            ['name' => 'Audit', 'description' => 'Prestations d\'audit', 'color' => '#F59E0B', 'icon' => 'clipboard'],
            ['name' => 'Séminaire', 'description' => 'Séminaires avec passes Classique, Premium et VIP', 'color' => '#EF4444', 'icon' => 'users'],
            ['name' => 'Autres activités', 'description' => 'Autres services et activités', 'color' => '#8B5CF6', 'icon' => 'sparkles'],
        ];

        $categoryIds = [];
        foreach ($categories as $data) {
            $category = Category::updateOrCreate(
                ['name' => $data['name']],
                array_diff_key($data, ['name' => ''])
            );
            $categoryIds[$data['name']] = $category->id;
        }

        $agency = Agency::where('name', 'Agence Principale Douala')->first();

        if (! $agency) {
            return;
        }

        $catalog = [
            [
                'name' => 'Formation Excel Avancé',
                'category' => 'Formations',
                'description' => 'Maîtrisez les fonctions avancées d\'Excel : tableaux croisés, formules complexes et automatisation.',
                'price' => 50000,
            ],
            [
                'name' => 'Formation Marketing Digital',
                'category' => 'Formations',
                'description' => 'Stratégie digitale, réseaux sociaux, SEO et publicité en ligne.',
                'price' => 75000,
            ],
            [
                'name' => 'Conseil en organisation',
                'category' => 'Conseil',
                'description' => 'Accompagnement à la réorganisation des processus internes.',
                'price' => 120000,
            ],
            [
                'name' => 'Audit comptable',
                'category' => 'Audit',
                'description' => 'Audit complet des états financiers et de la conformité.',
                'price' => 200000,
            ],
        ];

        foreach ($catalog as $data) {
            $serviceData = [
                'category_id' => $categoryIds[$data['category']],
                'agency_id' => $agency->id,
                'name' => $data['name'],
                'description' => $data['description'],
                'price' => $data['price'],
            ];

            $service = Service::updateOrCreate(
                ['name' => $data['name']],
                $serviceData
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
}
