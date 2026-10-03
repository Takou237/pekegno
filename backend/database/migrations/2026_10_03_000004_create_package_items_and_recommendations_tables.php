<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : contenu d'un package (les puces du flyer) et bloc
 * « Nos recommandations » (ex. 01 community manager, 02 commerciaux).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('package_id')->constrained('subscription_packs')->cascadeOnDelete();
            $table->foreignUuid('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->string('label');
            $table->unsignedInteger('quantity')->nullable();
            $table->string('frequency', 20)->nullable(); // per_day | per_week | per_month | once
            $table->string('unit', 50)->nullable();
            $table->string('action_type', 30)->nullable(); // type d'action générée dans la prestation
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('package_recommendations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('package_id')->constrained('subscription_packs')->cascadeOnDelete();
            $table->foreignUuid('client_team_role_id')->nullable()->constrained('client_team_roles')->nullOnDelete();
            $table->string('label');
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_recommendations');
        Schema::dropIfExists('package_items');
    }
};
