<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_modules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->unsignedInteger('order_index')->default(0);
            $table->unsignedInteger('duration_hours')->nullable();
            $table->foreignUuid('trainer_id')->nullable()->constrained('trainers')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['course_id', 'order_index']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_modules');
    }
};
