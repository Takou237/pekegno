<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * B4 — la catégorie d'une ligne de facture est portée par la ligne elle-même.
     *
     * Jusqu'ici elle n'était lue que via `services.category_id`, ce qui perdait
     * les produits, les libellés libres et les lignes dont le service a changé de
     * catégorie. On stocke désormais `invoice_items.category_id`, avec repli sur
     * le service dans les requêtes pour l'historique.
     */
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->uuid('category_id')->nullable()->after('service_id')->index();
        });

        // Backfill : chaque ligne de service hérite de la catégorie du service.
        DB::table('invoice_items')
            ->whereNull('category_id')
            ->whereNotNull('service_id')
            ->update([
                'category_id' => DB::raw(
                    '(select services.category_id from services where services.id = invoice_items.service_id)'
                ),
            ]);
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropIndex(['category_id']);
            $table->dropColumn('category_id');
        });
    }
};
