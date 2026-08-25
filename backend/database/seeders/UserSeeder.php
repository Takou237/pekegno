<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::pluck('id', 'name');
        $agencies = Agency::all()->keyBy(fn ($a) => $a->name);
        $departments = Department::all()->keyBy(fn ($d) => $d->name);

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
                'department' => null,
            ],
            [
                'username' => 'marie.ngono',
                'email' => 'marie.ngono@pekegno.com',
                'first_name' => 'Marie',
                'last_name' => 'Ngono',
                'phone' => '+237 690 000 002',
                'role' => 'direction-generale',
                'agencies' => [],
                'department' => null,
            ],
            // Responsables d'agence
            [
                'username' => 'paul.ekotto',
                'email' => 'paul.ekotto@pekegno.com',
                'first_name' => 'Paul',
                'last_name' => 'Ekotto',
                'phone' => '+237 690 000 003',
                'role' => 'responsable-agence',
                'agencies' => ['Agence Principale Douala'],
                'department' => null,
            ],
            [
                'username' => 'sophie.adje',
                'email' => 'sophie.adje@pekegno.com',
                'first_name' => 'Sophie',
                'last_name' => 'Adje',
                'phone' => '+237 690 000 004',
                'role' => 'responsable-agence',
                'agencies' => ['Agence Yaoundé Centre'],
                'department' => null,
            ],
            [
                'username' => 'yao.kouassi',
                'email' => 'yao.kouassi@pekegno.com',
                'first_name' => 'Yao',
                'last_name' => 'Kouassi',
                'phone' => '+225 07 00 00 005',
                'role' => 'responsable-agence',
                'agencies' => ['Agence Plateau Abidjan'],
                'department' => null,
            ],
            // Commerciaux
            [
                'username' => 'carlos.fotso',
                'email' => 'carlos.fotso@pekegno.com',
                'first_name' => 'Carlos',
                'last_name' => 'Fotso',
                'phone' => '+237 690 000 006',
                'role' => 'commercial',
                'agencies' => ['Agence Principale Douala', 'Agence Yaoundé Centre'],
                'department' => 'Agency Douala',
            ],
            [
                'username' => 'fatima.bello',
                'email' => 'fatima.bello@pekegno.com',
                'first_name' => 'Fatima',
                'last_name' => 'Bello',
                'phone' => '+237 690 000 007',
                'role' => 'commercial',
                'agencies' => ['Agence Principale Douala'],
                'department' => 'Agency Douala',
            ],
            // Caissiers
            [
                'username' => 'youssef.hamid',
                'email' => 'youssef.hamid@pekegno.com',
                'first_name' => 'Youssef',
                'last_name' => 'Hamid',
                'phone' => '+237 690 000 008',
                'role' => 'caissier',
                'agencies' => ['Agence Principale Douala'],
                'department' => 'Store Douala',
            ],
            // Comptable
            [
                'username' => 'nadia.tchinda',
                'email' => 'nadia.tchinda@pekegno.com',
                'first_name' => 'Nadia',
                'last_name' => 'Tchinda',
                'phone' => '+237 690 000 009',
                'role' => 'comptable',
                'agencies' => ['Agence Principale Douala', 'Agence Yaoundé Centre'],
                'department' => null,
            ],
            // Formateur
            [
                'username' => 'emmanuel.ngue',
                'email' => 'emmanuel.ngue@pekegno.com',
                'first_name' => 'Emmanuel',
                'last_name' => 'Ngue',
                'phone' => '+237 690 000 010',
                'role' => 'formateur',
                'agencies' => ['Agence Principale Douala'],
                'department' => 'Academy Douala',
            ],
            // Responsable département
            [
                'username' => 'grace.tala',
                'email' => 'grace.tala@pekegno.com',
                'first_name' => 'Grace',
                'last_name' => 'Tala',
                'phone' => '+237 690 000 011',
                'role' => 'responsable-departement',
                'agencies' => ['Agence Principale Douala', 'Agence Yaoundé Centre'],
                'department' => 'Academy Douala',
            ],
            // Responsable département Studio
            [
                'username' => 'lucien.mbida',
                'email' => 'lucien.mbida@pekegno.com',
                'first_name' => 'Lucien',
                'last_name' => 'Mbida',
                'phone' => '+237 690 000 012',
                'role' => 'responsable-departement',
                'agencies' => ['Agence Principale Douala'],
                'department' => 'Studio Douala',
            ],
        ];

        foreach ($users as $userData) {
            $roleName = $userData['role'];
            $agencyNames = $userData['agencies'];
            $departmentName = $userData['department'] ?? null;
            unset($userData['role'], $userData['agencies'], $userData['department']);

            $user = User::firstOrCreate(
                ['email' => $userData['email']],
                array_merge($userData, [
                    'password' => Hash::make('password'),
                    'role_id' => $roles[$roleName] ?? null,
                    'is_active' => true,
                    'is_password_change_required' => false,
                ])
            );

            foreach ($agencyNames as $name) {
                if (isset($agencies[$name])) {
                    $isPrimary = $roleName === 'responsable-agence' && $agencyNames[0] === $name;
                    $deptId = $departmentName && isset($departments[$departmentName])
                        ? $departments[$departmentName]->id
                        : null;

                    $user->assignments()->syncWithoutDetaching([
                        $agencies[$name]->id => [
                            'is_primary' => $isPrimary,
                            'department_id' => $deptId,
                        ],
                    ]);
                }
            }
        }
    }
}
