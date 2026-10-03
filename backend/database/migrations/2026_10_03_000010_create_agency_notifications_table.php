<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : notifications in-app (staff et portail client) — rappels de
 * renouvellement (D14/D18), actions en retard, budget consommé.
 * `dedupe_key` garantit qu'une alerte n'est émise qu'une fois par seuil.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agency_notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('entity_type', 50)->nullable();
            $table->uuid('entity_id')->nullable();
            $table->json('data')->nullable();
            $table->string('dedupe_key')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'dedupe_key'], 'uq_agency_notification_dedupe');
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agency_notifications');
    }
};
