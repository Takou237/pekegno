<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $superAdmin = Role::firstOrCreate(
            ['name' => 'super-admin'],
            ['description' => 'Super administrateur – accès total', 'is_system' => true]
        );

        $admin = Role::firstOrCreate(
            ['name' => 'admin'],
            ['description' => 'Administrateur – gestion des utilisateurs et paramètres', 'is_system' => true]
        );

        $manager = Role::firstOrCreate(
            ['name' => 'manager'],
            ['description' => 'Manager – gestion des agences et départements', 'is_system' => true]
        );

        $user = Role::firstOrCreate(
            ['name' => 'user'],
            ['description' => 'Utilisateur standard', 'is_system' => true]
        );

        $superAdmin->permissions()->sync(Permission::all()->pluck('id'));

        $admin->permissions()->sync(
            Permission::whereIn('group', ['users', 'roles', 'permissions', 'agencies', 'departments', 'categories'])->pluck('id')
        );

        $manager->permissions()->sync(
            Permission::whereIn('group', ['agencies', 'departments', 'categories'])->pluck('id')
        );

        $user->permissions()->sync(
            Permission::whereIn('name', ['categories.view'])->pluck('id')
        );
    }
}
