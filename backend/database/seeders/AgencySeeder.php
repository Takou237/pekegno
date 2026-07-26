<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Department;
use Illuminate\Database\Seeder;

class AgencySeeder extends Seeder
{
    public function run(): void
    {
        $agencies = [
            [
                'name' => 'Agence Principale Douala',
                'country' => 'Cameroun',
                'city' => 'Douala',
                'address' => 'Boulevard de la République, Immeuble Tsogo, Douala',
                'phone' => '+237 233 42 00 00',
                'email' => 'douala@pekegno.com',
            ],
            [
                'name' => 'Agence Yaoundé Centre',
                'country' => 'Cameroun',
                'city' => 'Yaoundé',
                'address' => 'Rue 1.234, Bastos, Yaoundé',
                'phone' => '+237 222 31 00 00',
                'email' => 'yaounde@pekegno.com',
            ],
        ];

        $departments = [
            0 => ['Commercial', 'Formation', 'Comptabilité'],
            1 => ['Commercial', 'Formation'],
        ];

        foreach ($agencies as $index => $data) {
            $agency = Agency::create(array_merge($data, [
                'code' => Agency::generateNextCode(),
            ]));

            foreach ($departments[$index] as $deptName) {
                Department::create([
                    'agency_id' => $agency->id,
                    'name' => $deptName,
                ]);
            }
        }
    }
}
