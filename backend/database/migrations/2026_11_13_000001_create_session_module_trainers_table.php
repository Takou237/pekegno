<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Formateur d'un module PAR SESSION : un formateur confié au module « X »
 * de la session du 05/10 n'apparaît plus dans les autres sessions de la
 * formation. (course_modules.trainer_id n'est plus utilisé pour l'accès.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_module_trainers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('training_session_id')->constrained('training_sessions')->cascadeOnDelete();
            $table->foreignUuid('course_module_id')->constrained('course_modules')->cascadeOnDelete();
            $table->foreignUuid('trainer_id')->constrained('trainers')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['training_session_id', 'course_module_id']);
            $table->index('trainer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_module_trainers');
    }
};
