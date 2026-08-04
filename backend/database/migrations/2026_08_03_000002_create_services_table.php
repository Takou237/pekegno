<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->nullable()->constrained('agencies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('categories')->restrictOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2);
            $table->string('cover_image', 255)->nullable();
            $table->string('presentation_video', 255)->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        DB::statement(
            'ALTER TABLE services ADD CONSTRAINT services_agency_department_xor
             CHECK ((agency_id IS NOT NULL) != (department_id IS NOT NULL))'
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_agency_department_xor');
        Schema::dropIfExists('services');
    }
};
