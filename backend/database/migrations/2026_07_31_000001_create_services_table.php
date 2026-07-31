<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('category_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2);
            $table->string('coverage', 50)->nullable();
            $table->string('presentation_video', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index(['agency_id', 'department_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
