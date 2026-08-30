<?php

namespace Database\Seeders;

use App\Models\AccountingCategory;
use Illuminate\Database\Seeder;

class AccountingCategorySeeder extends Seeder
{
    public function run(): void
    {
        AccountingCategory::updateOrCreate(
            ['name' => 'Encaissement facture'],
            ['type' => 'income', 'agency_id' => null, 'is_system' => true],
        );

        $expenseCategories = [
            'Admin',
            'Commissions',
            'Publicité Client',
            'Publicité PC',
            'Publicité PCI',
            'Matootoo',
            'Livre',
            'Dépense diverse',
        ];

        foreach ($expenseCategories as $name) {
            AccountingCategory::updateOrCreate(
                ['name' => $name],
                ['type' => 'expense', 'agency_id' => null, 'is_system' => true],
            );
        }
    }
}
