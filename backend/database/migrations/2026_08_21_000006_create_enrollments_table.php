<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->foreign('session_id')->references('id')->on('training_sessions')->cascadeOnDelete();
            $table->uuid('learner_user_id');
            $table->foreign('learner_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('status', 20)->default('enrolled')->comment('enrolled | completed | cancelled');
            $table->boolean('attendance')->default(false);
            $table->dateTime('attended_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['session_id', 'learner_user_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
    }
};