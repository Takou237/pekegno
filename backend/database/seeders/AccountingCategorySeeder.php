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

        AccountingCategory::updateOrCreate(
            ['name' => 'Dépense diverse'],
            ['type' => 'expense', 'agency_id' => null, 'is_system' => true],
        );
    }
}
