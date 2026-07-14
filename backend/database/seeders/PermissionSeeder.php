<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['id' => Str::uuid(), 'name' => 'creer',      'description' => 'Permet de créer de nouveaux éléments'],
            ['id' => Str::uuid(), 'name' => 'modifier',   'description' => 'Permet de modifier des éléments existants'],
            ['id' => Str::uuid(), 'name' => 'supprimer',  'description' => 'Permet de supprimer des éléments'],
            ['id' => Str::uuid(), 'name' => 'exporter',   'description' => 'Permet d\'exporter des données'],
            ['id' => Str::uuid(), 'name' => 'consulter',  'description' => 'Permet de consulter des données'],
            ['id' => Str::uuid(), 'name' => 'imprimer',   'description' => 'Permet d\'imprimer des documents'],
            ['id' => Str::uuid(), 'name' => 'valider',    'description' => 'Permet de valider des opérations'],
            ['id' => Str::uuid(), 'name' => 'encaisser',  'description' => 'Permet d\'encaisser des paiements'],
            ['id' => Str::uuid(), 'name' => 'annuler',    'description' => 'Permet d\'annuler des opérations'],
        ];

        DB::table('permissions')->insert($permissions);
    }
}
