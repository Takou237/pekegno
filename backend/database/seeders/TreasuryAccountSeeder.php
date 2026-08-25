<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\TreasuryAccount;
use Illuminate\Database\Seeder;

class TreasuryAccountSeeder extends Seeder
{
    public function run(): void
    {
        $agencies = Agency::all();

        $accountTemplates = [
            ['name' => 'Caisse Principale', 'type' => 'cash', 'provider' => null],
            ['name' => 'Orange Money', 'type' => 'mobile_money', 'provider' => 'orange_money'],
            ['name' => 'MTN MoMo', 'type' => 'mobile_money', 'provider' => 'mtn_momo'],
            ['name' => 'Compte Afriland', 'type' => 'bank', 'provider' => 'afriland'],
        ];

        foreach ($agencies as $agency) {
            foreach ($accountTemplates as $template) {
                TreasuryAccount::create([
                    'agency_id' => $agency->id,
                    'name' => $template['name'],
                    'type' => $template['type'],
                    'provider' => $template['provider'],
                    'opening_balance' => 0,
                    'currency_code' => $agency->geoCountry?->currency_code ?? 'XAF',
                    'is_active' => true,
                ]);
            }
        }
    }
}
