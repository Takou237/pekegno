<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\Organization;
use Illuminate\Database\Seeder;

class CountrySeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::firstOrCreate(
            ['code' => 'PEKEGNO'],
            ['name' => 'PEKEGNO Group', 'is_active' => true],
        );

        $countries = [
            ['code' => 'CMR', 'iso_code' => 'CM', 'name' => 'Cameroun', 'phone_code' => '+237', 'currency_code' => 'XAF'],
            ['code' => 'CIV', 'iso_code' => 'CI', 'name' => "Côte d'Ivoire", 'phone_code' => '+225', 'currency_code' => 'XOF'],
        ];

        foreach ($countries as $data) {
            Country::updateOrCreate(
                ['code' => $data['code']],
                array_merge($data, ['organization_id' => $organization->id, 'is_active' => true]),
            );
        }
    }
}