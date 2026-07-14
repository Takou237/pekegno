<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'super-admin',            'description' => 'Super Administrateur',                   'created_at' => now(), 'updated_at' => now()],
            ['name' => 'direction-generale',     'description' => 'Direction Générale',                     'created_at' => now(), 'updated_at' => now()],
            ['name' => 'responsable-agence',     'description' => 'Responsable Agence',                     'created_at' => now(), 'updated_at' => now()],
            ['name' => 'responsable-departement','description' => 'Responsable Département',                'created_at' => now(), 'updated_at' => now()],
            ['name' => 'commercial',             'description' => 'Commercial',                             'created_at' => now(), 'updated_at' => now()],
            ['name' => 'caissier',               'description' => 'Caissier',                               'created_at' => now(), 'updated_at' => now()],
            ['name' => 'comptable',              'description' => 'Comptable',                              'created_at' => now(), 'updated_at' => now()],
            ['name' => 'formateur',              'description' => 'Formateur',                              'created_at' => now(), 'updated_at' => now()],
        ];

        foreach ($roles as &$r) {
            $r['id'] = Str::uuid();
        }

        DB::table('roles')->insert($roles);

        // Assigner les permissions à chaque rôle
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
