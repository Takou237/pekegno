<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::pluck('id', 'name');
        $agencies = Agency::pluck('id');

        $users = [
            // Direction Générale
            [
                'username' => 'jean.mbarga',
                'email' => 'jean.mbarga@pekegno.com',
                'first_name' => 'Jean',
                'last_name' => 'Mbarga',
                'phone' => '+237 690 000 001',
                'role' => 'direction-generale',
                'agencies' => [],
            ],
            [
                'username' => 'marie.ngono',
                'email' => 'marie.ngono@pekegno.com',
                'first_name' => 'Marie',
                'last_name' => 'Ngono',
                'phone' => '+237 690 000 002',
                'role' => 'direction-generale',
                'agencies' => [],
            ],
            // Responsables d'agence
            [
                'username' => 'paul.ekotto',
                'email' => 'paul.ekotto@pekegno.com',
                'first_name' => 'Paul',
                'last_name' => 'Ekotto',
                'phone' => '+237 690 000 003',
                'role' => 'responsable-agence',
                'agencies' => [0], // première agence = chef
            ],
            [
                'username' => 'sophie.adje',
                'email' => 'sophie.adje@pekegno.com',
                'first_name' => 'Sophie',
                'last_name' => 'Adje',
                'phone' => '+237 690 000 004',
                'role' => 'responsable-agence',
                'agencies' => [1], // deuxième agence = chef
            ],
            // Commerciaux
            [
                'username' => 'carlos.fotso',
                'email' => 'carlos.fotso@pekegno.com',
                'first_name' => 'Carlos',
                'last_name' => 'Fotso',
                'phone' => '+237 690 000 005',
                'role' => 'commercial',
                'agencies' => [0, 1],
            ],
            [
                'username' => 'fatima.bello',
                'email' => 'fatima.bello@pekegno.com',
                'first_name' => 'Fatima',
                'last_name' => 'Bello',
                'phone' => '+237 690 000 006',
                'role' => 'commercial',
                'agencies' => [0],
            ],
            // Caissiers
            [
                'username' => 'youssef.hamid',
                'email' => 'youssef.hamid@pekegno.com',
                'first_name' => 'Youssef',
                'last_name' => 'Hamid',
                'phone' => '+237 690 000 007',
                'role' => 'caissier',
                'agencies' => [0],
            ],
            // Comptable
            [
                'username' => 'nadia.tchinda',
                'email' => 'nadia.tchinda@pekegno.com',
                'first_name' => 'Nadia',
                'last_name' => 'Tchinda',
                'phone' => '+237 690 000 008',
                'role' => 'comptable',
                'agencies' => [0, 1],
            ],
            // Formateur
            [
                'username' => 'emmanuel.ngue',
                'email' => 'emmanuel.ngue@pekegno.com',
                'first_name' => 'Emmanuel',
                'last_name' => 'Ngue',
                'phone' => '+237 690 000 009',
                'role' => 'formateur',
                'agencies' => [0],
            ],
            // Responsable département
            [
                'username' => 'grace.tala',
                'email' => 'grace.tala@pekegno.com',
                'first_name' => 'Grace',
                'last_name' => 'Tala',
                'phone' => '+237 690 000 010',
                'role' => 'responsable-departement',
                'agencies' => [0, 1],
            ],
        ];

        foreach ($users as $userData) {
            $roleName = $userData['role'];
            $agencyIndices = $userData['agencies'];
            unset($userData['role'], $userData['agencies']);

            $user = User::firstOrCreate(
                ['email' => $userData['email']],
                array_merge($userData, [
                    'password' => Hash::make('password'),
                    'role_id' => $roles[$roleName] ?? null,
                    'is_active' => true,
                    'is_password_change_required' => false,
                ])
            );

            // Assigner aux agences
            foreach ($agencyIndices as $index) {
                if (isset($agencies[$index])) {
                    $isPrimary = $roleName === 'responsable-agence' && $agencyIndices[0] === $index;

                    $user->assignments()->syncWithoutDetaching([
                        $agencies[$index] => [
                            'is_primary' => $isPrimary,
                            'department_id' => null,
                        ],
                    ]);
                }
            }
        }
    }
}
