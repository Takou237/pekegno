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
            ['name' => 'super-admin', 'description' => 'Super Administrateur'],
            ['name' => 'direction-generale', 'description' => 'Direction Générale'],
            ['name' => 'responsable-agence', 'description' => 'Responsable Agence'],
            ['name' => 'responsable-departement', 'description' => 'Responsable Département'],
            ['name' => 'commercial', 'description' => 'Commercial'],
            ['name' => 'caissier', 'description' => 'Caissier'],
            ['name' => 'comptable', 'description' => 'Comptable'],
            ['name' => 'formateur', 'description' => 'Formateur'],
            ['name' => 'client', 'description' => 'Client'],
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
                $p('agencies', ['consulter', 'modifier', 'exporter']),
                $p('departments', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('categories', ['consulter', 'creer', 'modifier']),
                $p('services', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('promotions', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('users', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('clients', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('commercials', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('invoices', ['consulter', 'creer', 'modifier', 'imprimer', 'annuler', 'exporter']),
                $p('stats', ['consulter']),
            ),
            'responsable-departement' => array_merge(
                $p('agencies', ['consulter', 'modifier', 'exporter']),
                $p('departments', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('categories', ['consulter', 'creer', 'modifier']),
                $p('services', ['consulter', 'creer', 'modifier', 'exporter']),
                $p('promotions', ['consulter', 'creer', 'modifier', 'supprimer']),
                $p('users', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('clients', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('commercials', ['consulter', 'creer', 'modifier', 'supprimer', 'exporter']),
                $p('invoices', ['consulter', 'creer', 'modifier', 'imprimer', 'annuler', 'exporter']),
                $p('stats', ['consulter']),
            ),
            'commercial' => array_merge(
                $p('clients', ['consulter']),
                $p('commercials', ['consulter']),
                $p('services', ['consulter']),
                $p('categories', ['consulter']),
                $p('promotions', ['consulter']),
                $p('invoices', ['consulter', 'creer', 'imprimer', 'encaisser']),
                $p('stats', ['consulter']),
            ),
            'caissier' => array_merge(
                $p('clients', ['consulter']),
                $p('services', ['consulter']),
                $p('categories', ['consulter']),
                $p('invoices', ['consulter', 'creer', 'imprimer', 'encaisser']),
            ),
            'comptable' => array_merge(
                $p('clients', ['consulter', 'exporter']),
                $p('commercials', ['consulter', 'exporter']),
                $p('services', ['consulter']),
                $p('categories', ['consulter']),
                $p('invoices', ['consulter', 'imprimer', 'encaisser', 'exporter']),
                $p('stats', ['consulter']),
            ),
            'formateur' => array_merge(
                $p('services', ['consulter']),
                $p('categories', ['consulter']),
                $p('promotions', ['consulter']),
            ),
            'client' => [],
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
