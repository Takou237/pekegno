<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : rôles métier de l'équipe client (Community manager, Graphiste…).
 * Ils ne donnent AUCUNE permission applicative (≠ table roles).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_team_roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_team_roles');
    }
};
