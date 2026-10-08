<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offres de prestation : la fiche « Campagne Facebook » à laquelle les
 * clients souscrivent (nom + catégorie). Chaque souscription client reste
 * une ligne de `prestations`, liée via `prestations.offer_id`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestation_offers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained('agency_categories')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['agency_id', 'department_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestation_offers');
    }
};
