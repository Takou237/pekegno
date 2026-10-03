<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency (D2) : catégories propres au département Agency, distinctes du
 * catalogue services/produits. `kind` sépare les catégories de packages
 * de celles des prestations.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agency_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('kind', 20); // package | prestation
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 20)->nullable();
            $table->string('icon', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['department_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agency_categories');
    }
};
