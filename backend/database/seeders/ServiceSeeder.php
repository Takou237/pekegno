<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Category;
use App\Models\Department;
use App\Models\Service;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Formation', 'description' => 'Formations présentielles et distancielles', 'color' => '#3B82F6', 'icon' => 'GraduationCap'],
            ['name' => 'Consulting', 'description' => 'Prestations de conseil et d\'accompagnement', 'color' => '#10B981', 'icon' => 'Briefcase'],
            ['name' => 'Événement', 'description' => 'Organisation d\'événements et ateliers', 'color' => '#F59E0B', 'icon' => 'CalendarDays'],
            ['name' => 'Service commercial', 'description' => 'Activités commerciales et ventes', 'color' => '#8B5CF6', 'icon' => 'ShoppingCart'],
        ];

        $categoryIds = [];
        foreach ($categories as $cat) {
            $categoryIds[$cat['name']] = Category::firstOrCreate(['name' => $cat['name']], $cat)->id;
        }

        $agency = Agency::first();
        if (! $agency) {
            $this->command?->warn('Aucune agence trouvée. Lancez AgencySeeder avant ServiceSeeder.');

            return;
        }

        $department = Department::where('agency_id', $agency->id)->first();
        $user = User::first();

        $services = [
            [
                'name' => 'Formation Marketing Digital',
                'category' => 'Formation',
                'price' => 250000,
                'coverage' => 'Nationale',
                'description' => 'Initiation complète au marketing digital : réseaux sociaux, référencement, publicité en ligne.',
                'promo' => [200000, Carbon::now()->subDays(3), Carbon::now()->addDays(25)],
            ],
            [
                'name' => 'Formation Gestion de Projet',
                'category' => 'Formation',
                'price' => 300000,
                'coverage' => 'Nationale',
                'description' => 'Méthodologies agiles, planning, suivi et pilotage de projets.',
            ],
            [
                'name' => 'Accompagnement Business Plan',
                'category' => 'Consulting',
                'price' => 150000,
                'coverage' => 'Régionale',
                'description' => 'Élaboration et validation d\'un business plan structuré.',
                'promo' => [120000, Carbon::now()->addDays(2), Carbon::now()->addDays(45)],
            ],
            [
                'name' => 'Atelier Prise de Parole en Public',
                'category' => 'Événement',
                'price' => 50000,
                'coverage' => 'Locale',
                'description' => 'Atelier d\'une journée pour améliorer sa communication orale.',
            ],
            [
                'name' => 'Pack Domiciliation + Bureautique',
                'category' => 'Service commercial',
                'price' => 75000,
                'coverage' => 'Nationale',
                'description' => 'Domiciliation d\'entreprise et accompagnement bureautique mensuel.',
            ],
        ];

        foreach ($services as $index => $data) {
            $service = Service::create([
                'agency_id' => $agency->id,
                'department_id' => $department?->id,
                'category_id' => $categoryIds[$data['category']],
                'name' => $data['name'],
                'price' => $data['price'],
                'coverage' => $data['coverage'],
                'description' => $data['description'] ?? null,
            ]);

            if ($user) {
                $service->priceHistory()->create([
                    'price' => $data['price'],
                    'changed_by' => $user->id,
                    'reason' => $index === 0 ? 'Prix de lancement' : 'Prix initial',
                ]);
            }

            if (isset($data['promo'])) {
                [$promoPrice, $start, $end] = $data['promo'];
                $service->promotions()->create([
                    'promotional_price' => $promoPrice,
                    'start_date' => $start,
                    'end_date' => $end,
                    'is_active' => true,
                ]);
            }
        }
    }
}
