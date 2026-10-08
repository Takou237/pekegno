<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * N1 (doc/TODO_Agency.md §5, D23) : note globale directe du client sur la
 * prestation. Prioritaire sur la moyenne des notes d'actions pour l'affichage
 * (`display_rating_*`). Nullable : n'altère pas le comportement existant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prestations', function (Blueprint $table) {
            $table->tinyInteger('client_direct_rating')->nullable()->after('rating_count');
            $table->text('client_direct_comment')->nullable()->after('client_direct_rating');
            $table->timestamp('client_direct_rated_at')->nullable()->after('client_direct_comment');
            $table->foreignUuid('client_direct_rated_by')->nullable()->after('client_direct_rated_at')
                ->constrained('users')->nullOnDelete();
            $table->index('client_direct_rating');
        });
    }

    public function down(): void
    {
        Schema::table('prestations', function (Blueprint $table) {
            $table->dropForeign(['client_direct_rated_by']);
            $table->dropIndex(['client_direct_rating']);
        });

        Schema::table('prestations', function (Blueprint $table) {
            $table->dropColumn([
                'client_direct_rating',
                'client_direct_comment',
                'client_direct_rated_at',
                'client_direct_rated_by',
            ]);
        });
    }
};