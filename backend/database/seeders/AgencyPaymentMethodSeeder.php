<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\AgencyPaymentMethod;
use Illuminate\Database\Seeder;

class AgencyPaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        $agencies = Agency::all()->keyBy('name');

        $methods = [
            'Agence Principale Douala' => [
                ['provider' => 'orange_money', 'phone_number' => '+237 690 00 00 01', 'account_holder' => 'PEKEGNO Douala'],
                ['provider' => 'mtn_momo', 'phone_number' => '+237 670 00 00 01', 'account_holder' => 'PEKEGNO Douala'],
                ['provider' => 'bank_transfer', 'phone_number' => null, 'account_holder' => 'PEKEGNO SARL (UBA Cameroun)', 'instructions' => 'Virement sur le compte UBA 1234 5678 90'],
            ],
            'Agence Yaoundé Centre' => [
                ['provider' => 'orange_money', 'phone_number' => '+237 690 00 00 02', 'account_holder' => 'PEKEGNO Yaoundé'],
                ['provider' => 'mtn_momo', 'phone_number' => '+237 670 00 00 02', 'account_holder' => 'PEKEGNO Yaoundé'],
            ],
            'Agence Plateau Abidjan' => [
                ['provider' => 'orange_money', 'phone_number' => '+225 07 07 00 00 03', 'account_holder' => 'PEKEGNO Abidjan'],
                ['provider' => 'mtn_momo', 'phone_number' => '+225 05 05 00 00 03', 'account_holder' => 'PEKEGNO Abidjan'],
                ['provider' => 'wave', 'phone_number' => '+225 05 05 00 00 03', 'account_holder' => 'PEKEGNO Abidjan'],
            ],
        ];

        foreach ($methods as $agencyName => $items) {
            $agency = $agencies->get($agencyName);
            if (! $agency) {
                continue;
            }
            foreach ($items as $item) {
                AgencyPaymentMethod::firstOrCreate(
                    ['agency_id' => $agency->id, 'provider' => $item['provider']],
                    array_merge($item, ['is_active' => true]),
                );
            }
        }
    }
}