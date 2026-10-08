<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Occurrences / exécutions concrètes d'une action de prestation.
 * Permet de lister les actions à exécuter par semaine (ex. 2x/semaine pendant 3 mois = 24 exécutions),
 * d'y renseigner les preuves, coûts et dates effectives, et d'en ajouter manuellement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestation_action_executions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_action_id')->constrained('prestation_actions')->cascadeOnDelete();
            $table->unsignedInteger('week_number')->default(1);
            $table->date('week_start_date')->nullable();
            $table->date('week_end_date')->nullable();
            $table->unsignedInteger('occurrence_number')->default(1);
            $table->string('title')->nullable();
            $table->string('status', 20)->default('todo');
            $table->date('scheduled_date')->nullable();
            $table->dateTime('done_at')->nullable();
            $table->string('proof_url', 2048)->nullable();
            $table->decimal('actual_cost', 15, 2)->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_manual')->default(false);
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['prestation_action_id', 'week_number'], 'idx_pa_exec_week');
            $table->index(['prestation_action_id', 'status'], 'idx_pa_exec_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestation_action_executions');
    }
};

