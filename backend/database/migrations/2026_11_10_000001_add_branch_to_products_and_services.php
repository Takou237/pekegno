<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * B24 — la branche d'un article est portée par l'article lui-même
     * (Academy, Agency, Store, Studio). Elle devient la source unique pour le
     * Store, le suivi des ventes et le rattachement comptable, au lieu de
     * déduire la branche du nom de la catégorie.
     */
    public function up(): void
    {
        foreach (['products', 'services'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('branch', 20)->nullable()->after('category_id')->index();
            });
        }

        // Backfill : une catégorie qui nomme une branche la conserve, sinon on
        // garde le comportement actuel du rattachement comptable (Store).
        foreach (['products' => 'store', 'services' => 'store'] as $tableName => $fallback) {
            DB::table($tableName)->whereNull('branch')->update([
                'branch' => DB::raw(
                    "coalesce((select lower(categories.name) from categories where categories.id = {$tableName}.category_id and lower(categories.name) in ('academy', 'agency', 'store', 'studio')), '{$fallback}')"
                ),
            ]);
        }
    }

    public function down(): void
    {
        foreach (['products', 'services'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropIndex(['branch']);
                $table->dropColumn('branch');
            });
        }
    }
};
