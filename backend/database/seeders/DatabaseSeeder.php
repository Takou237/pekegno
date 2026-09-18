<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            RoleSeeder::class,
            AccountingCategorySeeder::class,
            OrganizationSeeder::class,
            CountrySeeder::class,
            CitySeeder::class,
            ClientCategorySeeder::class,
            AdminUserSeeder::class,
            AgencySeeder::class,
            TreasuryAccountSeeder::class,
            UserSeeder::class,
            SettingSeeder::class,
            AgencyPaymentMethodSeeder::class,
            CommercialTestDataSeeder::class,
            PublicCatalogSeeder::class,
            TrainingSessionSeeder::class,
            ExpenseAndTreasurySeeder::class,
            DemoExtrasSeeder::class,
            BackfillFinancialsSeeder::class,
            DemoExtras2Seeder::class,
            DemoExtras3Seeder::class,
        ]);
    }
}
