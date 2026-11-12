<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 7 — Présences par séance datée (MVP §10, CdC §7).
 *
 * Ajoute la colonne `session_date` à la table `attendances`
 * pour permettre d'enregistrer et de filtrer les présences par date de séance.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->date('session_date')->nullable()->after('course_module_id');
            // Mettre à jour la contrainte d'unicité pour inclure la date de séance
            $table->dropUnique('attendances_session_module_learner_unique');
            $table->unique(['training_session_id', 'course_module_id', 'session_date', 'learner_user_id'], 'attendances_session_module_date_learner_unique');
            $table->index(['training_session_id', 'session_date']);
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex(['training_session_id', 'session_date']);
            $table->dropUnique('attendances_session_module_date_learner_unique');
            $table->dropColumn('session_date');
            $table->unique(['training_session_id', 'course_module_id', 'learner_user_id'], 'attendances_session_module_learner_unique');
        });
    }
};
