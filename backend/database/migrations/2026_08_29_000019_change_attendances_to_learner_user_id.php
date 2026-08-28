<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropForeign(['enrollment_id']);
            $table->dropUnique('attendances_training_session_id_enrollment_id_unique');
            $table->dropColumn('enrollment_id');

            // La présence est rattachée à l'apprenant (inscrit à la formation),
            // pas à l'ancienne table d'inscriptions par session.
            $table->foreignUuid('learner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unique(['training_session_id', 'learner_user_id'], 'attendances_session_learner_unique');
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropUnique('attendances_session_learner_unique');
            $table->dropForeign(['learner_user_id']);
            $table->dropColumn('learner_user_id');

            $table->foreignUuid('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->unique(['training_session_id', 'enrollment_id'], 'attendances_training_session_id_enrollment_id_unique');
        });
    }
};