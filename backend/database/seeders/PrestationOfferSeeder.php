<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\AgencyCategory;
use App\Models\Department;
use App\Models\PrestationOffer;
use App\Models\SubscriptionPack;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Offres de prestation de démonstration : la fiche « Campagne Facebook » à
 * laquelle les clients souscrivent. Une offre par agence (Douala, Yaoundé,
 * Abidjan), reliée à une catégorie d'agence réelle de son département.
 * Idempotent (updateOrCreate sur nom + agence).
 */
class PrestationOfferSeeder extends Seeder
{
    /** @var array<string, array{category: string, description: string}> */
    private const DEFINITIONS = [
        'Campagne Facebook' => [
            'category' => 'Réseaux sociaux',
            'description' => 'Création, publicité et animation de votre page Facebook : visuels, ciblage et reporting mensuel.',
        ],
        'Community management' => [
            'category' => 'Réseaux sociaux',
            'description' => 'Animation quotidienne de vos communautés, modération et réponse aux clients sur tous vos réseaux.',
        ],
        'Shooting professionnel' => [
            'category' => 'Services à la carte',
            'description' => 'Séance photo et vidéo professionnelle pour vos produits, votre équipe ou votre marque.',
        ],
        'Égérie de marque' => [
            'category' => 'Services à la carte',
            'description' => 'Partenariat avec une personnalité pour représenter et promouvoir votre marque auprès de sa communauté.',
        ],
        'Influenceur' => [
            'category' => 'Services à la carte',
            'description' => 'Sélection d’influenceurs, négociation et pilotage de votre campagne d’influence de bout en bout.',
        ],
    ];

    public function run(): void
    {
        $creator = User::query()->where('email', 'admin@pekegno.com')->first();

        $agencyIds = SubscriptionPack::query()->distinct()->pluck('agency_id');

        // Les offres venues d'agences hors jeu de démo (doublons issus d'un
        // ancien seed) sont retirées pour garder un catalogue cohérent.
        PrestationOffer::query()->whereNotIn('agency_id', $agencyIds)->delete();

        foreach (Agency::query()->whereIn('id', $agencyIds)->orderBy('name')->get() as $agency) {
            $department = Department::query()
                ->where('agency_id', $agency->id)
                ->where('type', 'agency')
                ->first();

            foreach (self::DEFINITIONS as $name => $definition) {
                $category = AgencyCategory::query()
                    ->where('department_id', $department?->id)
                    ->where('kind', AgencyCategory::KIND_PRESTATION)
                    ->where('name', $definition['category'])
                    ->first();

                if (! $category && $department !== null) {
                    $category = AgencyCategory::create([
                        'name' => $definition['category'],
                        'kind' => AgencyCategory::KIND_PRESTATION,
                        'department_id' => $department->id,
                        'is_active' => true,
                    ]);
                }

                PrestationOffer::updateOrCreate(
                    ['agency_id' => $agency->id, 'name' => $name],
                    [
                        'department_id' => $department?->id,
                        'category_id' => $category?->id,
                        'description' => $definition['description'],
                        'is_active' => true,
                        'created_by' => $creator?->id,
                    ]
                );
            }
        }

        $this->command?->info('Offres de prestation de démonstration créées.');
    }
}