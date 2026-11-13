<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Catalogue des rubriques de vente (T0.4 / T3.6) : chaque article a sa
 * rubrique, une rubrique = une catégorie. Academy, Agency et Séminaire
 * restent des rubriques fixes calculées par SaleBranch.
 */
return new class extends Migration
{
    /** @var array<string, array{0: string, 1: string}> nom => [couleur, icône] */
    private const RUBRICS = [
        'Canva' => ['#00C4CC', 'palette'],
        'Livre' => ['#8B5CF6', 'book'],
        'Graphisme' => ['#F97316', 'pen-tool'],
        'Tik Tok' => ['#111827', 'music'],
        'Matootoo' => ['#10B981', 'shopping-bag'],
        'Séminaire' => ['#EF4444', 'users'],
    ];

    /** @var array<string, string> nom de l'article => rubrique */
    private const CATALOG = [
        'Canva Pro' => 'Canva',
        "Livre Comment Gagner de l'Argent en Ligne en Afrique" => 'Livre',
        'Logo ou Identité de marque' => 'Graphisme',
        'Tik Tok Monetise' => 'Tik Tok',
        'Bootcamp 3 jours, Yaoundé' => 'Séminaire',
    ];

    public function up(): void
    {
        $categoryIds = [];

        foreach (self::RUBRICS as $name => [$color, $icon]) {
            $existing = DB::table('categories')->where('name', $name)->first();

            if ($existing) {
                // Une catégorie supprimée puis recréée redevient active.
                DB::table('categories')->where('id', $existing->id)->update([
                    'deleted_at' => null,
                    'updated_at' => now(),
                ]);
                $categoryIds[$name] = $existing->id;

                continue;
            }

            $categoryIds[$name] = (string) Str::uuid();
            DB::table('categories')->insert([
                'id' => $categoryIds[$name],
                'name' => $name,
                'description' => "Rubrique de vente {$name}",
                'color' => $color,
                'icon' => $icon,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach (self::CATALOG as $article => $rubric) {
            DB::table('services')
                ->where('name', $article)
                ->update(['category_id' => $categoryIds[$rubric], 'updated_at' => now()]);

            DB::table('products')
                ->where('name', $article)
                ->update(['category_id' => $categoryIds[$rubric], 'updated_at' => now()]);
        }

        // « Store » n'est plus une rubrique : chaque article a la sienne. On ne
        // la retire que si plus aucun article ne l'utilise.
        $storeId = DB::table('categories')
            ->where('name', 'Store')
            ->whereNull('deleted_at')
            ->value('id');

        if ($storeId) {
            $stillUsed = DB::table('services')
                ->where('category_id', $storeId)
                ->whereNull('deleted_at')
                ->exists()
                || DB::table('products')
                    ->where('category_id', $storeId)
                    ->whereNull('deleted_at')
                    ->exists();

            if (! $stillUsed) {
                DB::table('categories')->where('id', $storeId)->update([
                    'deleted_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Pas de retour arrière : les articles gardent leur rubrique.
    }
};
