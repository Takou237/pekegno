<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Utilisateurs
            ['name' => 'users.view', 'label' => 'Voir les utilisateurs', 'group' => 'users'],
            ['name' => 'users.create', 'label' => 'Créer des utilisateurs', 'group' => 'users'],
            ['name' => 'users.edit', 'label' => 'Modifier les utilisateurs', 'group' => 'users'],
            ['name' => 'users.delete', 'label' => 'Supprimer des utilisateurs', 'group' => 'users'],
            // Rôles
            ['name' => 'roles.view', 'label' => 'Voir les rôles', 'group' => 'roles'],
            ['name' => 'roles.create', 'label' => 'Créer des rôles', 'group' => 'roles'],
            ['name' => 'roles.edit', 'label' => 'Modifier les rôles', 'group' => 'roles'],
            ['name' => 'roles.delete', 'label' => 'Supprimer des rôles', 'group' => 'roles'],
            // Permissions
            ['name' => 'permissions.view', 'label' => 'Voir les permissions', 'group' => 'permissions'],
            ['name' => 'permissions.create', 'label' => 'Créer des permissions', 'group' => 'permissions'],
            ['name' => 'permissions.edit', 'label' => 'Modifier les permissions', 'group' => 'permissions'],
            ['name' => 'permissions.delete', 'label' => 'Supprimer des permissions', 'group' => 'permissions'],
            // Agences
            ['name' => 'agencies.view', 'label' => 'Voir les agences', 'group' => 'agencies'],
            ['name' => 'agencies.create', 'label' => 'Créer des agences', 'group' => 'agencies'],
            ['name' => 'agencies.edit', 'label' => 'Modifier les agences', 'group' => 'agencies'],
            ['name' => 'agencies.delete', 'label' => 'Supprimer des agences', 'group' => 'agencies'],
            // Départements
            ['name' => 'departments.view', 'label' => 'Voir les départements', 'group' => 'departments'],
            ['name' => 'departments.create', 'label' => 'Créer des départements', 'group' => 'departments'],
            ['name' => 'departments.edit', 'label' => 'Modifier les départements', 'group' => 'departments'],
            ['name' => 'departments.delete', 'label' => 'Supprimer des départements', 'group' => 'departments'],
            // Catégories
            ['name' => 'categories.view', 'label' => 'Voir les catégories', 'group' => 'categories'],
            ['name' => 'categories.create', 'label' => 'Créer des catégories', 'group' => 'categories'],
            ['name' => 'categories.edit', 'label' => 'Modifier les catégories', 'group' => 'categories'],
            ['name' => 'categories.delete', 'label' => 'Supprimer des catégories', 'group' => 'categories'],
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm['name']], $perm);
        }
    }
}
