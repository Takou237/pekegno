<?php

namespace Database\Seeders;

use App\Models\Organization;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    public function run(): void
    {
        Organization::updateOrCreate(
            ['code' => 'PEKEGNO'],
            ['name' => 'PEKEGNO Group', 'is_active' => true],
        );
    }
}