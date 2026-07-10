<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@pekegno.com'],
            [
                'username' => 'admin',
                'password' => Hash::make('password'),
                'first_name' => 'Admin',
                'last_name' => 'PEKEGNO',
                'is_super_admin' => true,
                'is_active' => true,
                'must_change_password' => false,
            ]
        );

        $superAdminRole = Role::where('name', 'super-admin')->first();
        if ($superAdminRole) {
            $admin->roles()->syncWithoutDetaching([$superAdminRole->id]);
        }
    }
}
