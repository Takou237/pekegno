<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->foreignUuid('course_module_id')->nullable()->after('learner_user_id')->constrained('course_modules')->nullOnDelete();

            // Nouvelle contrainte : (session, module, apprenant).
            $table->dropUnique('attendances_session_learner_unique');
            $table->unique(['training_session_id', 'course_module_id', 'learner_user_id'], 'attendances_session_module_learner_unique');
            $table->index('course_module_id');
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex('attendances_session_module_learner_unique');
            $table->dropForeign(['course_module_id']);
            $table->dropColumn('course_module_id');

            $table->unique(['training_session_id', 'learner_user_id'], 'attendances_session_learner_unique');
        });
    }
};
