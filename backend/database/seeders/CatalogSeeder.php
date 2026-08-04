<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Department;
use App\Models\Formation;
use App\Models\Module;
use App\Models\PriceHistory;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Formations', 'description' => 'Formations présentiel et distanciel', 'color' => '#3B82F6', 'icon' => 'book'],
            ['name' => 'Conseil', 'description' => 'Prestations de conseil', 'color' => '#10B981', 'icon' => 'briefcase'],
            ['name' => 'Audit', 'description' => 'Prestations d\'audit', 'color' => '#F59E0B', 'icon' => 'clipboard'],
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
        $department = $agency?->departments()->where('name', 'Formation')->first();

        if (! $agency || ! $department) {
            return;
        }

        $formateur = User::whereHas('role', fn ($q) => $q->where('name', 'formateur'))->first();

        $catalog = [
            [
                'name' => 'Formation Excel Avancé',
                'category' => 'Formations',
                'description' => 'Maîtrisez les fonctions avancées d\'Excel : tableaux croisés, formules complexes et automatisation.',
                'price' => 50000,
                'type' => 'distanciel',
                'formation' => true,
                'duration' => '6 semaines',
                'conditions' => 'Avoir une base en Excel est recommandé.',
                'deposit_amount' => 15000,
                'installments_count' => 3,
                'online_payment' => true,
                'modules' => [
                    ['name' => 'Introduction et environnement', 'type' => 'video'],
                    ['name' => 'Formules avancées', 'type' => 'cours'],
                    ['name' => 'Tableaux croisés dynamiques', 'type' => 'exercice'],
                    ['name' => 'Exercices de synthèse', 'type' => 'quiz'],
                ],
            ],
            [
                'name' => 'Formation Marketing Digital',
                'category' => 'Formations',
                'description' => 'Stratégie digitale, réseaux sociaux, SEO et publicité en ligne.',
                'price' => 75000,
                'type' => 'presentiel',
                'formation' => true,
                'duration' => '8 semaines',
                'conditions' => 'Aucun prérequis.',
                'deposit_amount' => 20000,
                'installments_count' => 4,
                'online_payment' => false,
                'modules' => [
                    ['name' => 'Fondamentaux du marketing digital', 'type' => 'cours'],
                    ['name' => 'Réseaux sociaux', 'type' => 'video'],
                    ['name' => 'SEO et contenu', 'type' => 'pdf'],
                    ['name' => 'Campagnes publicitaires', 'type' => 'exercice'],
                ],
            ],
            [
                'name' => 'Conseil en organisation',
                'category' => 'Conseil',
                'description' => 'Accompagnement à la réorganisation des processus internes.',
                'price' => 120000,
                'type' => null,
            ],
            [
                'name' => 'Audit comptable',
                'category' => 'Audit',
                'description' => 'Audit complet des états financiers et de la conformité.',
                'price' => 200000,
                'type' => null,
            ],
        ];

        foreach ($catalog as $data) {
            $name = $data['name'];
            $serviceData = [
                'category_id' => $categoryIds[$data['category']],
                'agency_id' => $data['type'] === null ? $agency->id : null,
                'department_id' => $data['type'] === null ? null : $department->id,
                'name' => $name,
                'description' => $data['description'],
                'price' => $data['price'],
            ];

            $service = Service::updateOrCreate(
                ['name' => $name],
                $serviceData
            );

            if (! PriceHistory::where('service_id', $service->id)->exists()) {
                PriceHistory::create([
                    'service_id' => $service->id,
                    'price' => $service->price,
                    'changed_at' => now(),
                ]);
            }

            if ($data['type'] !== null) {
                Formation::updateOrCreate(
                    ['id' => $service->id],
                    [
                        'type' => $data['type'],
                        'duration' => $data['duration'],
                        'conditions' => $data['conditions'],
                        'deposit_amount' => $data['deposit_amount'],
                        'installments_count' => $data['installments_count'],
                        'online_payment' => $data['online_payment'],
                    ]
                );

                foreach (array_values($data['modules']) as $index => $moduleData) {
                    Module::updateOrCreate(
                        ['formation_id' => $service->id, 'name' => $moduleData['name']],
                        [
                            'order' => $index,
                            'type' => $moduleData['type'],
                            'trainer_id' => $formateur?->id,
                        ]
                    );
                }
            }
        }
    }
}
