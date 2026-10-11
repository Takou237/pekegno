<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fiche client complète (recette 2026-10) : nationalité, quartier et occupation
 * manquaient à la création de client (le reste — nom, contact, email, ville,
 * pays, adresse — existait déjà sur la table users).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nationality', 100)->nullable()->after('address');
            $table->string('quartier', 150)->nullable()->after('nationality');
            $table->string('occupation', 150)->nullable()->after('quartier');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['nationality', 'quartier', 'occupation']);
        });
    }
};
