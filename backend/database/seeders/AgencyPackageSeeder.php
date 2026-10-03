<?php

namespace Database\Seeders;

use App\Models\AgencyCategory;
use App\Models\ClientTeamRole;
use App\Models\Department;
use App\Models\SubscriptionPack;
use Illuminate\Database\Seeder;

/**
 * Agency (§9 du plan) : packages du flyer « Packages stratégiques mensuels »
 * + services à la carte + rôles d'équipe client par défaut, pour chaque
 * département de type agency. Idempotent (updateOrCreate par nom).
 *
 * NON appelé par DatabaseSeeder : à lancer explicitement après validation :
 *   php artisan db:seed --class=AgencyPackageSeeder
 */
class AgencyPackageSeeder extends Seeder
{
    private const STRATEGIC = [
        [
            'name' => 'Offre Starter',
            'tagline' => 'Lancez votre machine digitale',
            'original_price' => 370000,
            'price' => 299000,
            'items' => [
                ['01 campagne Facebook & Instagram / mois', 1, 'per_month', 'campagne', 'advertising'],
                ['Réalisation des supports visuels & vidéos pro', null, 'once', null, 'content_production'],
                ['Coaching mensuel du community manager (4 fois/mois)', 4, 'per_month', 'séance', 'coaching'],
                ['Script & stratégie de closing pour les commerciaux (4 fois/mois)', 4, 'per_month', 'séance', 'strategy'],
            ],
            'recommendations' => [['Community manager', 1], ['Commercial', 2]],
        ],
        [
            'name' => 'Offre Booster',
            'tagline' => 'Accélérer les ventes',
            'original_price' => 870000,
            'price' => 549000,
            'items' => [
                ['2 à 3 campagnes multi-plateformes (FB, IG)', 3, 'per_month', 'campagne', 'advertising'],
                ['Réalisation des supports visuels & vidéos pro', null, 'once', null, 'content_production'],
                ['Coaching de 1 h/jour (community manager + commerciaux)', 1, 'per_day', 'heure', 'coaching'],
                ['Tunnel de vente simplifié (pub - lead - relance - vente)', null, 'once', null, 'strategy'],
            ],
            'recommendations' => [['Community manager', 1], ['Commercial', 2]],
        ],
        [
            'name' => 'Offre Croissance',
            'tagline' => 'Construire un tunnel de vente',
            'original_price' => 910000,
            'price' => 799000,
            'items' => [
                ['04 campagnes ciblées + A/B testing', 4, 'per_month', 'campagne', 'advertising'],
                ['Réalisation des supports visuels & vidéos pro', null, 'once', null, 'content_production'],
                ['Coaching hebdomadaire (CM + équipe commerciale)', 1, 'per_week', 'séance', 'coaching'],
                ['Création de scripts vidéos, tunnels de vente, CRM', null, 'once', null, 'strategy'],
            ],
            'recommendations' => [['Community manager', 1], ['Commercial', 3]],
        ],
        [
            'name' => 'Offre Entreprise',
            'tagline' => 'Dominez votre marché',
            'original_price' => 1490000,
            'price' => 999000,
            'items' => [
                ['Plan média personnalisé', null, 'once', null, 'strategy'],
                ['Formation complète de l\'équipe + réalisation des supports visuel et vidéo', null, 'once', null, 'content_production'],
                ['Réunions stratégiques mensuelles avec rapport d\'impact', 1, 'per_month', 'réunion', 'strategy'],
            ],
            'recommendations' => [['Community manager', 1], ['Commercial', 4]],
        ],
    ];

    private const A_LA_CARTE = [
        ['Publicité Facebook', 249000, 209000, false, 'advertising'],
        ['Shooting professionnel', null, 50000, true, 'content_production'],
        ['Shooting et montage vidéo professionnel', null, 100000, true, 'content_production'],
        ['Égérie pour représenter la marque', null, 100000, true, 'other'],
        ['Influenceur ou influenceuse', null, 200000, true, 'community_management'],
    ];

    public function run(): void
    {
        Department::query()->where('type', Department::TYPE_AGENCY)->get()->each(function (Department $department) {
            $roles = [];
            foreach (ClientTeamRole::DEFAULTS as $name) {
                $roles[$name] = ClientTeamRole::firstOrCreate(['department_id' => $department->id, 'name' => $name]);
            }

            $strategic = AgencyCategory::firstOrCreate(
                ['department_id' => $department->id, 'kind' => AgencyCategory::KIND_PACKAGE, 'name' => 'Packages stratégiques mensuels'],
                ['sort_order' => 0],
            );
            $carte = AgencyCategory::firstOrCreate(
                ['department_id' => $department->id, 'kind' => AgencyCategory::KIND_PACKAGE, 'name' => 'Services à la carte'],
                ['sort_order' => 1],
            );

            foreach (self::STRATEGIC as $order => $def) {
                $package = $this->package($department, $strategic, $def['name'], [
                    'tagline' => $def['tagline'],
                    'original_price' => $def['original_price'],
                    'price_per_month' => $def['price'],
                    'sort_order' => $order,
                ]);

                $package->items()->delete();
                foreach ($def['items'] as $i => [$label, $qty, $frequency, $unit, $type]) {
                    $package->items()->create([
                        'label' => $label, 'quantity' => $qty, 'frequency' => $frequency,
                        'unit' => $unit, 'action_type' => $type, 'sort_order' => $i,
                    ]);
                }

                $package->recommendations()->delete();
                foreach ($def['recommendations'] as $i => [$roleName, $qty]) {
                    $package->recommendations()->create([
                        'client_team_role_id' => $roles[$roleName]->id,
                        'label' => $roleName, 'quantity' => $qty, 'sort_order' => $i,
                    ]);
                }
            }

            foreach (self::A_LA_CARTE as $order => [$name, $original, $price, $startingFrom, $type]) {
                $package = $this->package($department, $carte, $name, [
                    'original_price' => $original,
                    'price_per_month' => $price,
                    'price_is_starting_from' => $startingFrom,
                    'sort_order' => $order,
                ]);

                $package->items()->delete();
                $package->items()->create(['label' => $name, 'quantity' => 1, 'frequency' => 'per_month', 'action_type' => $type]);
            }
        });
    }

    private function package(Department $department, AgencyCategory $category, string $name, array $attributes): SubscriptionPack
    {
        $package = SubscriptionPack::firstOrNew(['department_id' => $department->id, 'name' => $name]);

        $package->fill($attributes + [
            'agency_id' => $department->agency_id,
            'category_id' => $category->id,
            'billing_period' => 'monthly',
            'is_active' => true,
        ]);

        if (! $package->code) {
            $package->code = SubscriptionPack::generateCode();
        }

        $package->save();

        return $package;
    }
}
