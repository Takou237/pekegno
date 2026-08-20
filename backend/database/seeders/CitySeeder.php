<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\Country;
use Illuminate\Database\Seeder;

class CitySeeder extends Seeder
{
    public function run(): void
    {
        $cmr = Country::where('code', 'CMR')->first();
        $civ = Country::where('code', 'CIV')->first();

        $cities = [
            'CMR' => ['Douala', 'Yaoundé', 'Bamenda'],
            'CIV' => ['Abidjan', 'Bouaké'],
        ];

        foreach ($cities as $countryCode => $names) {
            $country = $countryCode === 'CMR' ? $cmr : $civ;
            if (! $country) {
                continue;
            }

            foreach ($names as $name) {
                City::updateOrCreate(
                    ['country_id' => $country->id, 'name' => $name],
                    ['is_active' => true],
                );
            }
        }
    }
}