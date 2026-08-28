<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('course_categories');

        Schema::create('course_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 7)->nullable();
            $table->string('icon', 100)->nullable();
            $table->timestamps();
        });

        Schema::create('course_course_category', function (Blueprint $table) {
            $table->foreignUuid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignUuid('course_category_id')->constrained('course_categories')->cascadeOnDelete();
            $table->primary(['course_id', 'course_category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_course_category');
        Schema::dropIfExists('course_categories');

        Schema::create('course_categories', function (Blueprint $table) {
            $table->foreignUuid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('categories')->cascadeOnDelete();
            $table->primary(['course_id', 'category_id']);
        });
    }
};