<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50)->nullable()->unique();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->string('mode', 20)->default('in_person')->comment('online | in_person | mixed');
            $table->uuid('category_id')->nullable();
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
            $table->decimal('price', 14, 2)->default(0);
            $table->unsignedInteger('duration_hours')->nullable();
            $table->uuid('agency_id')->nullable()->comment('null = disponible dans toutes les agences');
            $table->foreign('agency_id')->references('id')->on('agencies')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('mode');
            $table->index('category_id');
            $table->index('agency_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};