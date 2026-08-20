<?php

namespace Database\Seeders;

use App\Models\ClientCategory;
use Illuminate\Database\Seeder;

class ClientCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['slug' => 'apprenant', 'name' => 'Apprenant', 'description' => 'Client inscrit à une formation (Academy)'],
            ['slug' => 'abonne', 'name' => 'Abonné', 'description' => 'Client avec un abonnement actif'],
            ['slug' => 'prospect', 'name' => 'Prospect', 'description' => 'Prospection commerciale'],
            ['slug' => 'autre', 'name' => 'Autre', 'description' => 'Autre type de client'],
        ];

        foreach ($categories as $data) {
            ClientCategory::updateOrCreate(
                ['slug' => $data['slug']],
                array_merge($data, ['is_active' => true]),
            );
        }
    }
}