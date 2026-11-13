<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Règles 2026 (MVP §6.2) : « Formateurs — 10 % ventes de livres » était
 * inactive faute de catégorie Livre au moment du paramétrage. La catégorie
 * existe désormais : nouvelle version de la règle, rattachée à elle et active
 * (l'ancienne version reste dans l'historique).
 */
return new class extends Migration
{
    public function up(): void
    {
        $category = DB::table('categories')->whereNull('deleted_at')->whereRaw('lower(name) like ?', ['livre%'])->orderBy('created_at')->first();
        $rule = DB::table('commission_rules')->whereNull('deleted_at')->where('name', 'Formateurs — 10 % ventes de livres')->orderByDesc('version')->first();

        if (! $category || ! $rule || $rule->category_id || $rule->is_active) {
            return;
        }

        $row = (array) $rule;
        DB::table('commission_rules')->where('id', $rule->id)->update(['is_active' => false, 'updated_at' => now()]);

        $row['id'] = (string) Str::uuid();
        $row['version'] = $rule->version + 1;
        $row['category_id'] = $category->id;
        $row['is_active'] = true;
        $row['description'] = 'Ventes de la catégorie « '.$category->name.' ».';
        $row['created_at'] = now();
        $row['updated_at'] = now();
        DB::table('commission_rules')->insert($row);
    }

    public function down(): void
    {
        // L'historique des versions est conservé.
    }
};
