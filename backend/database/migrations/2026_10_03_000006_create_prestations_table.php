<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : une prestation est l'exécution concrète d'un service pour un
 * client (budget global, période, commercial vendeur). Elle peut provenir
 * d'un package (D3) ; sa validation crée le contrat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('reference', 30)->unique(); // PRS-2026-0001
            $table->foreignUuid('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained('agency_categories')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignUuid('client_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignUuid('commercial_id')->nullable()->constrained('commercials')->nullOnDelete();
            $table->foreignUuid('package_id')->nullable()->constrained('subscription_packs')->nullOnDelete();
            $table->foreignUuid('contract_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('budget', 15, 2)->default(0);
            // D17 : taux de commission saisi sur une prestation hors package.
            $table->string('commission_type', 10)->nullable(); // percent | fixed
            $table->decimal('commission_value', 12, 2)->nullable();
            $table->string('status', 30)->default('draft');
            $table->text('status_reason')->nullable();
            $table->decimal('rating_avg', 3, 1)->nullable();
            $table->unsignedInteger('rating_count')->default(0);
            $table->foreignUuid('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'status']);
            $table->index('client_id');
        });

        Schema::create('prestation_team_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_id')->constrained('prestations')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('client_team_role_id')->nullable()->constrained('client_team_roles')->nullOnDelete();
            $table->boolean('is_lead')->default(false);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->timestamps();

            $table->unique(['prestation_id', 'user_id', 'client_team_role_id'], 'uq_prestation_team_member');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestation_team_members');
        Schema::dropIfExists('prestations');
    }
};
