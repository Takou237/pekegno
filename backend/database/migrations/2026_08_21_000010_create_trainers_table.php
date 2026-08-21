<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Les formateurs deviennent des profils autonomes (table trainers), liés
 * optionnellement à un compte utilisateur. Un formateur n'a plus besoin
 * d'un compte pour exister ni pour être assigné à une session.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trainers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('agency_id')->nullable()->index();
            $table->uuid('user_id')->nullable()->unique();
            $table->string('first_name', 150)->nullable();
            $table->string('last_name', 150)->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('bio')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('agency_id')->references('id')->on('agencies')->nullOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        // Les sessions référencent désormais le profil formateur.
        Schema::table('training_sessions', function (Blueprint $table) {
            $table->uuid('trainer_id')->nullable()->after('course_id');
            $table->foreign('trainer_id')->references('id')->on('trainers')->nullOnDelete();
        });

        // Backfill : un profil est créé pour chaque formateur-user déjà référencé.
        // (UUID générés en PHP : gen_random_uuid() n'est pas toujours disponible.)
        $formateurRoleId = DB::table('roles')->where('name', 'formateur')->value('id');

        $trainerUserIds = DB::table('training_sessions')
            ->whereNotNull('trainer_user_id')
            ->distinct()
            ->pluck('trainer_user_id');

        foreach ($trainerUserIds as $userId) {
            $user = DB::table('users')
                ->when($formateurRoleId, fn ($q) => $q->where('role_id', $formateurRoleId))
                ->find($userId);

            if (! $user) {
                continue;
            }

            $trainerId = (string) Str::uuid();
            $now = now();

            DB::table('trainers')->insert([
                'id' => $trainerId,
                'user_id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_active' => $user->is_active,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('training_sessions')
                ->where('trainer_user_id', $userId)
                ->update(['trainer_id' => $trainerId]);
        }

        Schema::table('training_sessions', function (Blueprint $table) {
            $table->dropForeign(['trainer_user_id']);
            $table->dropColumn('trainer_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('training_sessions', function (Blueprint $table) {
            $table->uuid('trainer_user_id')->nullable()->after('course_id');
            $table->foreign('trainer_user_id')->references('id')->on('users')->nullOnDelete();
        });

        DB::statement(
            'UPDATE training_sessions s SET trainer_user_id = t.user_id FROM trainers t WHERE t.user_id IS NOT NULL'
        );

        Schema::table('training_sessions', function (Blueprint $table) {
            $table->dropForeign(['trainer_id']);
            $table->dropColumn('trainer_id');
        });

        Schema::dropIfExists('trainers');
    }
};
