<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CommissionRule;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Règles de commission par défaut, reprises de la grille de rémunération
 * (fonction → règles à prendre en charge), attribuées aux rôles existants.
 *
 * Les règles marquées « à définir / à préciser » dans la grille sont créées
 * INACTIVES avec une note : elles s'activent en les enregistrant depuis
 * Réglages > Commissions une fois complétées.
 *
 * Idempotent : une règle déjà présente (même nom) n'est pas modifiée, pour ne
 * pas écraser un réglage fait depuis l'interface.
 */
class DefaultCommissionRulesSeeder extends Seeder
{
    public function run(): void
    {
        $creator = User::whereHas('role', fn ($q) => $q->where('name', 'super-admin'))->orderBy('created_at')->first();
        if (! $creator) {
            $this->command?->warn('Aucun super-admin : règles de commission non créées.');

            return;
        }

        $books = Category::whereRaw('lower(name) like ?', ['livre%'])->first();
        $canvaProduct = Product::whereRaw('lower(name) like ?', ['%canva%'])->first();
        $canvaService = $canvaProduct ? null : Service::whereRaw('lower(name) like ?', ['%canva%'])->first();

        $rules = [
            // Commerciaux.
            [
                'name' => 'Commerciaux — paliers CA mensuel',
                'roles' => ['commercial'],
                'basis' => CommissionRule::BASIS_MONTHLY_REVENUE,
                'formula_type' => CommissionRule::FORMULA_TIERED,
                'revenue_scope' => 'own',
                'min_recovery_rate' => 80,
                'recovery_period' => 'previous_month',
                'description' => '≥1M : 0,5 % ; ≥2M : 1 % ; ≥3M : 2 % ; ≥4M : 2 % + 50 000 si recouvrement N-1 ≥ 80 % ; ≥5M : 3 % + 50 000 + cagnotte 100 000 si recouvrement N-1 ≥ 80 %.',
                'tiers_json' => [
                    ['min' => 1000000, 'percent' => 0.5],
                    ['min' => 2000000, 'percent' => 1],
                    ['min' => 3000000, 'percent' => 2],
                    ['min' => 4000000, 'percent' => 2, 'fixed_bonus' => 50000, 'bonus_requires_recovery' => true],
                    ['min' => 5000000, 'percent' => 3, 'fixed_bonus' => 50000, 'pot_bonus' => 100000, 'bonus_requires_recovery' => true],
                ],
            ],

            // Formateurs Academy.
            [
                'name' => 'Formateurs — 10 % ventes de livres',
                'roles' => ['formateur'],
                'basis' => CommissionRule::BASIS_SALE,
                'percent_value' => 10,
                'category_id' => $books?->id,
                'is_active' => $books !== null,
                'description' => $books ? 'Ventes de la catégorie « '.$books->name.' ».' : 'À compléter : choisir la catégorie des livres.',
            ],
            [
                'name' => 'Formateurs — 10 % Canva Pro',
                'roles' => ['formateur'],
                'basis' => CommissionRule::BASIS_SALE,
                'percent_value' => 10,
                'product_id' => $canvaProduct?->id,
                'service_id' => $canvaService?->id,
                'target_kind' => $canvaProduct ? 'product' : ($canvaService ? 'service' : null),
                'is_active' => $canvaProduct !== null || $canvaService !== null,
                'description' => ($canvaProduct || $canvaService) ? 'Ventes de Canva Pro.' : 'À compléter : choisir le produit Canva Pro (absent du catalogue).',
            ],
            [
                'name' => 'Formateurs — 10 % upgrades',
                'roles' => ['formateur'],
                'basis' => CommissionRule::BASIS_UPGRADE,
                'percent_value' => 10,
            ],
            [
                'name' => 'Formateurs — 10 % recommandations',
                'roles' => ['formateur'],
                'basis' => CommissionRule::BASIS_SALE,
                'target_kind' => 'course',
                'percent_value' => 10,
                'description' => 'Formations vendues ou recommandées par le formateur (formateur vendeur de l\'inscription).',
            ],
            [
                'name' => 'Formateurs — prime témoignage',
                'roles' => ['formateur'],
                'basis' => CommissionRule::BASIS_MANUAL,
                'formula_type' => CommissionRule::FORMULA_FIXED,
                'bonus_min' => 10000,
                'bonus_max' => 25000,
                'description' => 'Attribuée après validation qualité du témoignage.',
            ],

            // Community managers.
            [
                'name' => 'Community managers — 2 % chaque renouvellement',
                'roles' => ['community-manager'],
                'basis' => CommissionRule::BASIS_RENEWAL,
                'percent_value' => 2,
                'description' => 'Renouvellement mensuel (remplacé par la règle du 3e / 6e renouvellement quand elle s\'applique).',
            ],
            [
                'name' => 'Community managers — 5 % 3e renouvellement',
                'roles' => ['community-manager'],
                'basis' => CommissionRule::BASIS_RENEWAL,
                'renewal_number' => 3,
                'percent_value' => 5,
            ],
            [
                'name' => 'Community managers — 10 % 6e renouvellement',
                'roles' => ['community-manager'],
                'basis' => CommissionRule::BASIS_RENEWAL,
                'renewal_number' => 6,
                'percent_value' => 10,
            ],
            [
                'name' => 'Community managers — 10 % upgrades de packages',
                'roles' => ['community-manager'],
                'basis' => CommissionRule::BASIS_UPGRADE,
                'target_kind' => 'package',
                'percent_value' => 10,
            ],

            // Fonctions sans formule arrêtée : primes manuelles inactives.
            [
                'name' => 'Infographiste / Monteur vidéo — prime qualité / quantité',
                'roles' => [],
                'basis' => CommissionRule::BASIS_MANUAL,
                'formula_type' => CommissionRule::FORMULA_FIXED,
                'is_active' => false,
                'description' => 'Au-delà du volume attendu. Règle à définir avant activation (créer le rôle et l\'attribuer).',
            ],
            [
                'name' => 'Agent IA — prime innovation / volume / formation',
                'roles' => [],
                'basis' => CommissionRule::BASIS_MANUAL,
                'formula_type' => CommissionRule::FORMULA_FIXED,
                'is_active' => false,
                'description' => 'Règle à définir avant activation (créer le rôle et l\'attribuer).',
            ],
            [
                'name' => 'Caisse / Finance — prime de performance',
                'roles' => ['caissier'],
                'basis' => CommissionRule::BASIS_MANUAL,
                'formula_type' => CommissionRule::FORMULA_FIXED,
                'is_active' => false,
                'description' => 'Réduction des pertes, qualité du recouvrement, fiabilité des caisses/rapports : indicateurs et formules à définir.',
            ],

            // Chef Pekegno Agency (chef du département Agency).
            [
                'name' => 'Chef Pekegno Agency — 2 % 3e renouvellement',
                'roles' => ['responsable-departement'],
                'basis' => CommissionRule::BASIS_RENEWAL,
                'renewal_number' => 3,
                'percent_value' => 2,
            ],
            [
                'name' => 'Chef Pekegno Agency — 5 % 6e renouvellement',
                'roles' => ['responsable-departement'],
                'basis' => CommissionRule::BASIS_RENEWAL,
                'renewal_number' => 6,
                'percent_value' => 5,
            ],
            [
                'name' => 'Chef Pekegno Agency — 10 % renouvellement à date',
                'roles' => ['responsable-departement'],
                'basis' => CommissionRule::BASIS_RENEWAL,
                'renewal_on_time' => true,
                'percent_value' => 10,
                'is_active' => false,
                'description' => 'Assiette exacte à préciser avant activation.',
            ],
            [
                'name' => 'Chef Pekegno Agency — 10 % upgrades',
                'roles' => ['responsable-departement'],
                'basis' => CommissionRule::BASIS_UPGRADE,
                'target_kind' => 'package',
                'percent_value' => 10,
                'is_active' => false,
                'description' => 'Assiette exacte à préciser avant activation.',
            ],

            // Chefs d'agence.
            [
                'name' => 'Chefs d\'agence — objectif ×3 vs même mois N-1',
                'roles' => ['responsable-agence'],
                'basis' => CommissionRule::BASIS_GROWTH,
                'formula_type' => CommissionRule::FORMULA_TIERED,
                'revenue_scope' => 'agency',
                'growth_multiplier' => 3,
                'max_percent' => 2,
                'is_active' => false,
                'tiers_json' => [
                    ['min' => 3, 'percent' => 1],
                    ['min' => 4, 'percent' => 1.5],
                    ['min' => 5, 'percent' => 2],
                ],
                'description' => 'Pourcentage variable selon le dépassement, jusqu\'à 2 %. Paliers exacts à préciser avant activation (exemple pré-rempli).',
            ],
        ];

        $created = 0;
        foreach ($rules as $definition) {
            if (CommissionRule::where('name', $definition['name'])->exists()) {
                continue;
            }

            $roleNames = $definition['roles'];
            unset($definition['roles']);

            $rule = CommissionRule::create($definition + [
                'rule_group_id' => (string) Str::uuid(),
                'version' => 1,
                'trigger_event' => CommissionRule::TRIGGER_ON_PAYMENT,
                'formula_type' => CommissionRule::FORMULA_PERCENT,
                'revenue_scope' => 'own',
                'recovery_period' => 'previous_month',
                'is_active' => true,
                'created_by' => $creator->id,
            ]);

            $rule->roles()->sync(Role::whereIn('name', $roleNames)->pluck('id'));
            $created++;
        }

        $this->command?->info("Règles de commission par défaut : {$created} créée(s).");
    }
}
