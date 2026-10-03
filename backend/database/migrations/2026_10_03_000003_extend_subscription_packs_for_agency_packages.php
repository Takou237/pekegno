<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : un package est un pack d'abonnement enrichi (catégorie, accroche,
 * prérequis, prix barré, période…). Les colonnes existantes sont conservées.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_packs', function (Blueprint $table) {
            $table->string('code', 30)->nullable()->unique()->after('id');
            $table->foreignUuid('department_id')->nullable()->after('agency_id')->constrained('departments')->nullOnDelete();
            $table->foreignUuid('category_id')->nullable()->after('department_id')->constrained('agency_categories')->nullOnDelete();
            $table->string('tagline')->nullable()->after('name');
            $table->text('prerequisites')->nullable()->after('description');
            $table->decimal('original_price', 15, 2)->nullable()->after('price_per_month');
            $table->boolean('price_is_starting_from')->default(false)->after('original_price');
            $table->string('billing_period', 20)->default('monthly')->after('price_is_starting_from');
            $table->unsignedInteger('min_duration_months')->nullable()->after('billing_period');
            $table->unsignedInteger('sort_order')->default(0)->after('min_duration_months');
            $table->boolean('is_public')->default(false)->after('is_active');
            $table->string('cover_image')->nullable()->after('is_public');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_packs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
            $table->dropConstrainedForeignId('category_id');
            $table->dropUnique(['code']);
            $table->dropColumn([
                'code', 'tagline', 'prerequisites', 'original_price', 'price_is_starting_from',
                'billing_period', 'min_duration_months', 'sort_order', 'is_public', 'cover_image',
            ]);
        });
    }
};
