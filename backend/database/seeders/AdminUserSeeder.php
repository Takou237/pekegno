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
        $superAdminRole = Role::where('name', 'super-admin')->first();

        $admin = User::firstOrCreate(
            ['email' => 'admin@pekegno.com'],
            [
                'username' => 'admin',
                'password' => Hash::make('password'),
                'first_name' => 'Admin',
                'last_name' => 'PEKEGNO',
                'role_id' => $superAdminRole?->id,
                'is_active' => true,
                'is_password_change_required' => false,
            ]
        );
    }
}
