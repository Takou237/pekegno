<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cible d'une règle par genre : « tous les produits », « tous les packages »…
 * Le choix d'un élément précis (product_id, package_id…) devient optionnel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            // product | service | course | package ; null = toutes les ventes.
            $table->string('target_kind', 20)->nullable()->after('basis');
        });
    }

    public function down(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            $table->dropColumn('target_kind');
        });
    }
};
