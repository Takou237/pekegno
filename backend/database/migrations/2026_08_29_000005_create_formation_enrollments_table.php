<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('formation_enrollments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignUuid('learner_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignUuid('seller_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('enrolled_at');
            $table->string('status', 20)->default('enrolled')
                ->checkIn(['enrolled', 'completed', 'cancelled']);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['course_id', 'learner_user_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('formation_enrollments');
    }
};
