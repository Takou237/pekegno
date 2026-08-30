<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Les certificats pointaient vers la table « enrollments » (par session).
        //    On la remplace par formation_enrollments avant de supprimer l'ancienne table.
        if (Schema::hasTable('certificates')) {
            Schema::table('certificates', function (Blueprint $table) {
                $table->dropForeign(['enrollment_id']);
                $table->foreign('enrollment_id')
                    ->references('id')
                    ->on('formation_enrollments')
                    ->cascadeOnDelete();
            });
        }

        Schema::dropIfExists('enrollments');

        // 2. Table de liaison Inscription (FormationEnrollment) <-> Session (TrainingSession)
        Schema::create('session_participants', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('training_session_id')
                ->constrained('training_sessions')
                ->cascadeOnDelete();

            $table->foreignUuid('formation_enrollment_id')
                ->constrained('formation_enrollments')
                ->cascadeOnDelete();

            $table->string('status', 20)->default('enrolled')
                ->comment('enrolled | cancelled');

            $table->timestamps();

            $table->unique(['training_session_id', 'formation_enrollment_id'], 'session_participant_unique');
            $table->index('status');
        });

        // 3. Backfill : on reprend les inscriptions actives existantes, mais uniquement
        //    pour les sessions qui commencent après leur date d'inscription.
        //    (jamais d'assignation rétroactive dans les cohortes passées).
        $enrollments = DB::table('formation_enrollments')
            ->whereNot('status', 'cancelled')
            ->get(['id', 'course_id', 'enrolled_at']);

        $sessions = DB::table('training_sessions')
            ->whereNull('deleted_at')
            ->get(['id', 'course_id', 'start_at'])
            ->groupBy('course_id');

        $now = now();
        $count = 0;

        DB::transaction(function () use ($enrollments, $sessions, $now, &$count) {
            foreach ($enrollments as $enrollment) {
                foreach ($sessions->get($enrollment->course_id, collect()) as $session) {
                    if ($session->start_at < $enrollment->enrolled_at) {
                        continue;
                    }

                    DB::table('session_participants')->insert([
                        'id' => Str::uuid()->toString(),
                        'training_session_id' => $session->id,
                        'formation_enrollment_id' => $enrollment->id,
                        'status' => 'enrolled',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    $count++;
                }
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_participants');
    }
};