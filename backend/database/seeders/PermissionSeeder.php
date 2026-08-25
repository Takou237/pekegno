<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    /**
     * Matrice entité × action. Chaque permission est nommée "entité.action".
     */
    private const GROUPS = [
        'users' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'roles' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'agencies' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'countries' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'cities' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'departments' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'categories' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'services' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'products' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'promotions' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'clients' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'commercials' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter', 'reporting'],
        'employes' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'prospects' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'invoices' => ['consulter', 'creer', 'modifier', 'imprimer', 'annuler', 'encaisser', 'exporter'],
        'activity-logs' => ['consulter', 'exporter'],
        'settings' => ['modifier'],
        'stats' => ['consulter'],
        'comptabilite' => ['consulter', 'creer', 'modifier', 'supprimer', 'exporter'],
        'accounting-categories' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'bilans' => ['consulter', 'exporter'],
        'abonnements' => ['consulter', 'creer', 'modifier', 'supprimer', 'renouveler'],
        'tresories' => ['consulter', 'modifier'],
        'courses' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'sessions' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'enrollments' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'orders' => ['consulter', 'creer', 'modifier', 'supprimer'],
        'reports' => ['consulter', 'exporter'],
        'depenses' => ['consulter', 'creer', 'modifier', 'supprimer', 'valider', 'encaisser', 'exporter'],
        'commissions' => ['consulter', 'creer', 'modifier', 'supprimer', 'valider', 'encaisser', 'exporter'],
    ];

    private const ACTION_LABELS = [
        'consulter' => 'Consulter',
        'creer' => 'Créer',
        'modifier' => 'Modifier',
        'supprimer' => 'Supprimer',
        'exporter' => 'Exporter',
        'imprimer' => 'Imprimer',
        'annuler' => 'Annuler',
        'encaisser' => 'Encaisser',
        'renouveler' => 'Renouveler',
        'reporting' => 'Reporting',
        'valider' => 'Valider',
    ];

    private const ENTITY_LABELS = [
        'users' => 'les utilisateurs',
        'roles' => 'les rôles',
        'agencies' => 'les agences',
        'countries' => 'les pays',
        'cities' => 'les villes',
        'departments' => 'les départements',
        'categories' => 'les catégories',
        'services' => 'les services',
        'products' => 'les produits',
        'promotions' => 'les promotions',
        'clients' => 'les clients',
        'commercials' => 'les commerciaux',
        'employes' => 'les employés',
        'prospects' => 'les prospects',
        'invoices' => 'les factures',
        'activity-logs' => "le journal d'activité",
        'settings' => 'les réglages',
        'stats' => 'les statistiques',
        'comptabilite' => 'la comptabilité',
        'accounting-categories' => 'les catégories comptables',
        'bilans' => 'les bilans du jour',
        'abonnements' => 'les abonnements',
        'tresories' => 'la trésorerie',
        'courses' => 'les cours',
        'sessions' => 'les sessions de formation',
        'enrollments' => 'les inscriptions aux formations',
        'orders' => 'les commandes',
        'reports' => 'les rapports',
        'depenses' => 'les dépenses',
        'commissions' => 'les commissions',
    ];

    public static function permissionNames(): array
    {
        $names = [];

        foreach (self::GROUPS as $entity => $actions) {
            foreach ($actions as $action) {
                $names[] = "$entity.$action";
            }
        }

        return $names;
    }

    public function run(): void
    {
        // Anciennes permissions génériques (Phase 1/2), remplacées par la matrice entité.action
        Permission::whereIn('name', [
            'creer', 'modifier', 'supprimer', 'exporter', 'consulter', 'imprimer', 'valider', 'encaisser', 'annuler',
        ])->delete();

        foreach (self::GROUPS as $entity => $actions) {
            foreach ($actions as $action) {
                Permission::updateOrCreate(
                    ['name' => "$entity.$action"],
                    [
                        'description' => sprintf('%s : %s', self::ACTION_LABELS[$action], self::ENTITY_LABELS[$entity]),
                    ],
                );
            }
        }
    }
}
