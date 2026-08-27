<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_observations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('learner_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('course_id')->nullable()->constrained('courses')->cascadeOnDelete();
            $table->foreignUuid('session_id')->nullable()->constrained('training_sessions')->cascadeOnDelete();
            $table->text('content');
            $table->timestamps();

            $table->index(['learner_user_id', 'course_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_observations');
    }
};
