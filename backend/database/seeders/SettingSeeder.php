<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::set('sales_points_per_sale', 3, 'Points attribués par vente payée intégralement');
        Setting::set('inactivity_period_days', 14, "Jours sans vente payée avant pénalité d'inactivité");
        Setting::set('inactivity_penalty_points', 5, 'Points retirés en cas d\'inactivité');
        Setting::set('default_commission_type', 'none', 'Type de commission par défaut (none, percent, fixed)');
        Setting::set('default_commission_value', 0, 'Valeur de commission par défaut');
        Setting::set('invoice_prefix', 'PK', 'Préfixe des numéros de facture');
        Setting::set('prospect_points_per_add', 2, 'Points attribués par prospect ramené');
        Setting::set('prospect_points_per_conversion', 5, 'Points attribués lors de la conversion d\'un prospect en client');
    }
}
