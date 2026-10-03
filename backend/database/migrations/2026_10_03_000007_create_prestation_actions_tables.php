<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency : actions d'une prestation (ex. « 3 vidéos Facebook / semaine »).
 * Chaque action prélève son budget sur celui de la prestation (D4 : blocage
 * strict), a un statut suivi, des commentaires, un journal d'exécution et
 * une note client (D11).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestation_actions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_id')->constrained('prestations')->cascadeOnDelete();
            $table->foreignUuid('package_item_id')->nullable()->constrained('package_items')->nullOnDelete();
            $table->string('type', 30)->default('other');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('platform', 50)->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->string('frequency', 20)->default('once');
            $table->string('unit', 50)->nullable();
            $table->decimal('budget', 15, 2)->default(0);
            $table->decimal('actual_cost', 15, 2)->nullable();
            $table->boolean('is_pass_through')->default(false);
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable();
            $table->string('status', 20)->default('todo');
            $table->text('comment')->nullable();
            $table->unsignedTinyInteger('rating')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamp('overdue_notified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['prestation_id', 'status']);
        });

        Schema::create('prestation_action_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_action_id')->constrained('prestation_actions')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->string('attachment_path')->nullable();
            $table->timestamps();
        });

        Schema::create('prestation_action_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_action_id')->constrained('prestation_actions')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('done_at');
            $table->unsignedInteger('quantity_done')->default(1);
            $table->string('proof_url')->nullable();
            $table->decimal('cost', 15, 2)->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('prestation_action_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_action_id')->constrained('prestation_actions')->cascadeOnDelete();
            $table->foreignUuid('prestation_id')->constrained('prestations')->cascadeOnDelete();
            $table->foreignUuid('client_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();

            // D11 : une seule note par action et par client, modifiable.
            $table->unique(['prestation_action_id', 'client_user_id'], 'uq_action_review_client');
            $table->index('prestation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestation_action_reviews');
        Schema::dropIfExists('prestation_action_logs');
        Schema::dropIfExists('prestation_action_comments');
        Schema::dropIfExists('prestation_actions');
    }
};
