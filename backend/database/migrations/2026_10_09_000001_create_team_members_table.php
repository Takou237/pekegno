<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Annuaire des équipiers Agency (calque du modèle employé) : personnes qui
     * exécutent les actions des prestations, avec ou sans compte lié, avec
     * leurs commissions propres.
     */
    public function up(): void
    {
        Schema::create('team_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->nullable()->constrained('agencies')->nullOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('first_name', 150);
            $table->string('last_name', 150);
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->foreignUuid('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->string('commission_type', 20)->default('none');
            $table->decimal('commission_value', 12, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'is_active']);
            $table->index(['department_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_members');
    }
};
