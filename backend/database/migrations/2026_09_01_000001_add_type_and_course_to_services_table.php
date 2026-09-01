<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Segmenter les produits du catalogue selon leur nature :
 *   - physical (produit physique / stock)
 *   - service (service / prestation)
 *   - formation (formation rattachée à un cours de l'académie)
 *
 * Pour les formations, on lie le produit au cours correspondant via course_id
 * afin de conserver la structure académique (sessions, modules, apprenants).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('services', 'type')) {
            Schema::table('services', function (Blueprint $table) {
                $table->string('type', 20)->default('service')->after('is_seminar');
                $table->index('type');
            });
        }

        if (! Schema::hasColumn('services', 'course_id')) {
            Schema::table('services', function (Blueprint $table) {
                $table->foreignUuid('course_id')
                    ->nullable()
                    ->after('type')
                    ->constrained('courses')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('services', 'course_id')) {
            Schema::table('services', function (Blueprint $table) {
                $table->dropConstrainedForeignId('course_id');
            });
        }

        if (Schema::hasColumn('services', 'type')) {
            Schema::table('services', function (Blueprint $table) {
                $table->dropIndex(['type']);
                $table->dropColumn('type');
            });
        }
    }
};
