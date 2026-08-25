<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\City;
use App\Models\Department;
use App\Models\Organization;
use Illuminate\Database\Seeder;

class AgencySeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::where('code', 'PEKEGNO')->first();
        $cityDouala = City::where('name', 'Douala')->first();
        $cityYaounde = City::where('name', 'Yaoundé')->first();

        $agencies = [
            [
                'name' => 'Agence Principale Douala',
                'country' => 'Cameroun',
                'city' => 'Douala',
                'country_id' => $cityDouala?->country_id,
                'city_id' => $cityDouala?->id,
                'address' => 'Boulevard de la République, Immeuble Tsogo, Douala',
                'phone' => '+237 233 42 00 00',
                'email' => 'douala@pekegno.com',
            ],
            [
                'name' => 'Agence Yaoundé Centre',
                'country' => 'Cameroun',
                'city' => 'Yaoundé',
                'country_id' => $cityYaounde?->country_id,
                'city_id' => $cityYaounde?->id,
                'address' => 'Rue 1.234, Bastos, Yaoundé',
                'phone' => '+237 222 31 00 00',
                'email' => 'yaounde@pekegno.com',
            ],
        ];

        $departmentsByType = [
            Department::TYPE_ACADEMY => 'Academy',
            Department::TYPE_AGENCY  => 'Agency',
            Department::TYPE_STORE   => 'Store',
            Department::TYPE_STUDIO  => 'Studio',
        ];

        foreach ($agencies as $data) {
            $agency = Agency::create(array_merge($data, [
                'code' => Agency::generateNextCode(),
                'type' => 'agency',
                'organization_id' => $organization?->id,
            ]));

            foreach ($departmentsByType as $type => $label) {
                Department::create([
                    'agency_id' => $agency->id,
                    'name' => "{$label} {$agency->name}",
                    'type' => $type,
                ]);
            }
        }
    }
}
