<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('training_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('course_id');
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->uuid('trainer_user_id')->nullable();
            $table->foreign('trainer_user_id')->references('id')->on('users')->nullOnDelete();
            $table->uuid('agency_id')->nullable()->comment('null = hérite de l\'agence du cours');
            $table->foreign('agency_id')->references('id')->on('agencies')->nullOnDelete();
            $table->dateTime('start_at');
            $table->dateTime('end_at')->nullable();
            $table->string('location', 255)->nullable();
            $table->unsignedInteger('max_capacity')->nullable();
            $table->decimal('price', 14, 2)->nullable()->comment('null = prix du cours');
            $table->string('status', 20)->default('planned')->comment('planned | ongoing | completed | cancelled');
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('start_at');
            $table->index('agency_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_sessions');
    }
};