<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('training_session_id')->constrained('training_sessions')->cascadeOnDelete();
            $table->foreignUuid('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->string('status', 10)->default('present')
                ->checkIn(['present', 'absent', 'late', 'excused']);
            $table->foreignUuid('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();

            $table->unique(['training_session_id', 'enrollment_id']);
            $table->index('training_session_id');
            $table->index('enrollment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
