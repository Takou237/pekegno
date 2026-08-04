<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('formation_id')->constrained('formations')->cascadeOnDelete();
            $table->foreignUuid('trainer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->unsignedInteger('order');
            $table->text('description')->nullable();
            $table->string('type', 20);
            $table->string('cover_image', 255)->nullable();
            $table->string('video', 255)->nullable();
            $table->string('pdf', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modules');
    }
};
