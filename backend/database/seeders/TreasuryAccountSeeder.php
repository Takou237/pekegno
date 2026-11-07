<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\TreasuryAccount;
use Illuminate\Database\Seeder;

/**
 * T2.2 — une caisse C/O/M/B par agence (plus W/V en Côte d'Ivoire).
 *
 * Les caisses sont codifiées : C = espèces, O = Orange Money, M = MTN MoMo,
 * B = banque, W = Wave, V = Moov Money. Les comptes Mobile Money / Banque ne
 * sont visibles que de l'administration et de la direction.
 */
class TreasuryAccountSeeder extends Seeder
{
    private const RESTRICTED_ROLES = ['super-admin', 'direction-generale', 'comptable'];

    public function run(): void
    {
        $templates = [
            ['code' => 'C', 'name' => 'Caisse Principale', 'type' => 'cash', 'provider' => null],
            ['code' => 'O', 'name' => 'Orange Money', 'type' => 'mobile_money', 'provider' => 'orange_money'],
            ['code' => 'M', 'name' => 'MTN MoMo', 'type' => 'mobile_money', 'provider' => 'mtn_momo'],
            ['code' => 'B', 'name' => 'Compte bancaire', 'type' => 'bank', 'provider' => null],
        ];

        foreach (Agency::all() as $agency) {
            $currency = $agency->geoCountry?->currency_code ?? 'XAF';

            $templatesForAgency = $templates;

            // Côte d'Ivoire : Wave et Moov Money en plus des caisses communes.
            if ($currency === 'XOF') {
                $templatesForAgency[] = ['code' => 'W', 'name' => 'Wave', 'type' => 'mobile_money', 'provider' => 'wave'];
                $templatesForAgency[] = ['code' => 'V', 'name' => 'Moov Money', 'type' => 'mobile_money', 'provider' => 'moov_money'];
            }

            foreach ($templatesForAgency as $template) {
                TreasuryAccount::updateOrCreate(
                    ['agency_id' => $agency->id, 'code' => $template['code']],
                    [
                        'name' => $template['name'],
                        'type' => $template['type'],
                        'provider' => $template['provider'],
                        'opening_balance' => 0,
                        'currency_code' => $currency,
                        'is_active' => true,
                        'visible_roles' => $template['type'] === 'cash' ? null : self::RESTRICTED_ROLES,
                    ]
                );
            }
        }
    }
}
