<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les sessions ne sont plus synchronisées entre agences : une session
 * appartient à la seule agence de sa formation. La table miroir est retirée.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('training_sessions_synced');
    }

    public function down(): void
    {
        Schema::create('training_sessions_synced', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('source_session_id')->nullable()->index();
            $table->uuid('training_session_id')->nullable()->index();
            $table->uuid('agency_id')->nullable()->index();
            $table->uuid('course_id')->nullable()->index();
            $table->string('status', 20)->default('planned');
            $table->dateTime('start_at')->nullable();
            $table->dateTime('end_at')->nullable();
            $table->string('location', 255)->nullable();
            $table->unsignedInteger('max_capacity')->nullable();
            $table->decimal('price', 14, 2)->nullable();
            $table->string('trainer_id', 36)->nullable();
            $table->string('module_id', 36)->nullable();
            $table->string('source_user_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['course_id', 'agency_id', 'status']);
        });
    }
};
