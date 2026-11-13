<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * « Tik Tok Monétisé » est un produit de la branche Store : sa rubrique est
 * simplement sa catégorie du catalogue (une catégorie « TikTok » créée par
 * l'utilisateur s'affiche d'elle-même comme rubrique, branche Store). La
 * rubrique « Tik Tok » créée d'office le 13/11 est retirée : ses articles
 * reviennent dans la catégorie « Store ».
 */
return new class extends Migration
{
    public function up(): void
    {
        $tiktok = DB::table('categories')
            ->where('name', 'Tik Tok')
            ->where('description', 'Rubrique de vente Tik Tok')
            ->whereNull('deleted_at')
            ->first();

        if (! $tiktok) {
            return;
        }

        $store = DB::table('categories')->where('name', 'Store')->orderByRaw('deleted_at is not null')->first();
        if ($store) {
            DB::table('categories')->where('id', $store->id)->update(['deleted_at' => null, 'updated_at' => now()]);
            foreach (['services', 'products'] as $table) {
                DB::table($table)->where('category_id', $tiktok->id)->update(['category_id' => $store->id, 'updated_at' => now()]);
            }
        }

        DB::table('categories')->where('id', $tiktok->id)->update(['deleted_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Pas de retour : la rubrique d'un article reste sa catégorie.
    }
};
