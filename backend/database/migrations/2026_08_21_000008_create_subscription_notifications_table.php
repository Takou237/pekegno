<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('subscription_id')->constrained()->cascadeOnDelete();
            $table->string('notification_type');
            $table->date('scheduled_for')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('channel')->default('in-app');
            $table->unsignedInteger('attempt_count')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->unique(['subscription_id', 'notification_type']);
            $table->index(['status', 'notification_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_notifications');
    }
};