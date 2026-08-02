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
            ['name' => 'super-admin',             'description' => 'Super Administrateur'],
            ['name' => 'direction-generale',      'description' => 'Direction Générale'],
            ['name' => 'responsable-agence',      'description' => 'Responsable Agence'],
            ['name' => 'responsable-departement', 'description' => 'Responsable Département'],
            ['name' => 'commercial',              'description' => 'Commercial'],
            ['name' => 'caissier',                'description' => 'Caissier'],
            ['name' => 'comptable',               'description' => 'Comptable'],
            ['name' => 'formateur',               'description' => 'Formateur'],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role['name']], ['description' => $role['description']]);
        }

        // Ré-affectation idempotente des permissions par rôle
        $permissions = DB::table('permissions')->pluck('id', 'name');
        $rolesMap = DB::table('roles')->pluck('id', 'name');

        $assignments = [
            'super-admin' => $permissions->keys()->toArray(),
            'direction-generale' => $permissions->keys()->toArray(),
            'responsable-agence' => ['creer', 'modifier', 'supprimer', 'exporter', 'consulter', 'imprimer', 'valider', 'annuler'],
            'responsable-departement' => ['creer', 'modifier', 'supprimer', 'exporter', 'consulter', 'imprimer', 'valider', 'annuler'],
            'commercial' => ['creer', 'modifier', 'exporter', 'consulter', 'imprimer'],
            'caissier' => ['consulter', 'encaisser', 'imprimer'],
            'comptable' => ['consulter', 'exporter', 'imprimer', 'valider'],
            'formateur' => ['consulter', 'creer', 'modifier'],
        ];

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
