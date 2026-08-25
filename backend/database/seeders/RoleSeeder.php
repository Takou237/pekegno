<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'super-admin', 'description' => 'Accès complet à l\'ensemble de l\'application'],
            ['name' => 'direction-generale', 'description' => 'Pilote toutes les agences, les équipes et la comptabilité'],
            ['name' => 'responsable-agence', 'description' => 'Gère une agence, ses commerciaux, factures et promotions'],
            ['name' => 'responsable-departement', 'description' => 'Gère un département et ses équipes'],
            ['name' => 'commercial', 'description' => 'Suit sa clientèle, crée des factures et gagne des points'],
            ['name' => 'caissier', 'description' => 'Encaisse les paiements et édite les factures'],
            ['name' => 'comptable', 'description' => 'Consulte et exporte les factures et la comptabilité'],
            ['name' => 'formateur', 'description' => 'Consulte le catalogue de services et les promotions'],
            ['name' => 'client', 'description' => 'Compte client enregistré lors de l\'inscription en ligne'],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role['name']], ['description' => $role['description']]);
        }

        // Construction des permissions "entité.action"
        $p = fn (string $entity, array $actions): array => array_map(
            fn (string $action): string => "$entity.$action",
            $actions
        );

        $all = PermissionSeeder::permissionNames();

        $assignments = [
            'super-admin' => $all,
            'direction-generale' => $all,
            'responsable-agence' => array_merge(
                $p('prospects', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('agencies', ['consulter', 'modifier', 'exporter']),
                $p('departments', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('categories', ['consulter', 'creer', 'modifier']),
                $p('services', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('products', ['consulter', 'creer', 'modifier']),
                $p('promotions', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('users', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('clients', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('commercials', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter', 'reporting']),
                $p('employes', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('invoices', ['consulter', 'creer', 'modifier', 'imprimer', 'annuler', 'exporter']),
                $p('stats', ['consulter']),
                $p('comptabilite', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('accounting-categories', ['consulter', 'creer', 'modifier']),
                $p('bilans', ['consulter', 'exporter']),
                $p('abonnements', ['consulter', 'creer', 'modifier', 'supprimer', 'renouveler']),
                $p('courses', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('sessions', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('enrollments', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('orders', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('reports', ['consulter', 'exporter']),
                $p('depenses', ['consulter', 'creer', 'modifier', 'valider', 'encaisser', 'exporter']),
                $p('commissions', ['consulter', 'creer', 'modifier', 'valider', 'encaisser', 'exporter']),
                $p('entreprises', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('opportunites', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('activites', ['consulter', 'creer', 'modifier', 'supprimer']),
            ),
            'responsable-departement' => array_merge(
                $p('prospects', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('agencies', ['consulter', 'modifier', 'exporter']),
                $p('departments', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('categories', ['consulter', 'creer', 'modifier']),
                $p('services', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('products', ['consulter', 'creer', 'modifier']),
                $p('promotions', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('users', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('clients', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('commercials', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('invoices', ['consulter', 'creer', 'modifier', 'imprimer', 'annuler', 'exporter']),
                $p('stats', ['consulter']),
                $p('courses', ['consulter']),
                $p('sessions', ['consulter']),
                $p('enrollments', ['consulter']),
                $p('orders', ['consulter', 'creer', 'modifier']),
                $p('reports', ['consulter', 'exporter']),
                $p('depenses', ['consulter', 'creer', 'modifier']),
                $p('commissions', ['consulter']),
                $p('entreprises', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('opportunites', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('activites', ['consulter', 'creer', 'modifier', 'supprimer']),
            ),
            'commercial' => array_merge(
                $p('prospects', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('clients', ['consulter']),
                $p('commercials', ['consulter']),
                $p('services', ['consulter']),
                $p('products', ['consulter']),
                $p('categories', ['consulter']),
                $p('promotions', ['consulter']),
                $p('invoices', ['consulter', 'creer', 'imprimer', 'encaisser']),
                $p('stats', ['consulter']),
                $p('orders', ['consulter', 'creer', 'modifier']),
                $p('reports', ['consulter', 'exporter']),
                $p('entreprises', ['consulter', 'creer', 'modifier']),
                $p('opportunites', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('activites', ['consulter', 'creer', 'modifier', 'supprimer']),
            ),
            'caissier' => array_merge(
                $p('clients', ['consulter']),
                $p('services', ['consulter']),
                $p('products', ['consulter']),
                $p('categories', ['consulter']),
                $p('invoices', ['consulter', 'creer', 'imprimer', 'encaisser']),
                $p('comptabilite', ['consulter']),
                $p('bilans', ['consulter', 'exporter']),
                $p('abonnements', ['consulter', 'creer', 'renouveler']),
                $p('courses', ['consulter']),
                $p('sessions', ['consulter']),
                $p('enrollments', ['consulter']),
                $p('orders', ['consulter']),
                $p('reports', ['consulter']),
                $p('depenses', ['consulter', 'creer', 'encaisser']),
                $p('commissions', ['consulter']),
            ),
            'comptable' => array_merge(
                $p('clients', ['consulter', 'exporter']),
                $p('commercials', ['consulter', 'exporter', 'reporting']),
                $p('employes', ['consulter', 'exporter']),
                $p('services', ['consulter']),
                $p('products', ['consulter']),
                $p('categories', ['consulter']),
                $p('invoices', ['consulter', 'imprimer', 'encaisser', 'exporter']),
                $p('stats', ['consulter']),
                $p('comptabilite', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('accounting-categories', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('bilans', ['consulter', 'exporter']),
                $p('abonnements', ['consulter']),
                $p('courses', ['consulter']),
                $p('sessions', ['consulter']),
                $p('enrollments', ['consulter']),
                $p('orders', ['consulter']),
                $p('reports', ['consulter', 'exporter']),
                $p('depenses', ['consulter', 'creer', 'modifier', 'valider', 'encaisser', 'exporter']),
                $p('commissions', ['consulter', 'creer', 'modifier', 'valider', 'encaisser', 'exporter']),
                $p('entreprises', ['consulter', 'exporter']),
                $p('opportunites', ['consulter', 'exporter']),
                $p('activites', ['consulter']),
            ),
            'formateur' => array_merge(
                $p('services', ['consulter']),
                $p('products', ['consulter']),
                $p('categories', ['consulter']),
                $p('promotions', ['consulter']),
                $p('courses', ['consulter']),
                $p('sessions', ['consulter', 'creer', 'modifier']),
                $p('enrollments', ['consulter', 'modifier']),
            ),
            'client' => array_merge(
                $p('services', ['consulter']),
                $p('products', ['consulter']),
                $p('categories', ['consulter']),
                $p('courses', ['consulter']),
                $p('sessions', ['consulter']),
                $p('enrollments', ['consulter']),
            ),
        ];

        $permissions = DB::table('permissions')->pluck('id', 'name');
        $rolesMap = DB::table('roles')->pluck('id', 'name');

        DB::table('role_permission')->delete();

        $rolePermissions = [];

        foreach ($assignments as $roleName => $permNames) {
            $roleId = $rolesMap[$roleName] ?? null;
            if (! $roleId) {
                continue;
            }

            foreach ($permNames as $permName) {
                $permId = $permissions[$permName] ?? null;
                if ($permId) {
                    $rolePermissions[] = [
                        'role_id' => $roleId,
                        'permission_id' => $permId,
                    ];
                }
            }
        }

        DB::table('role_permission')->insert($rolePermissions);
    }
}
