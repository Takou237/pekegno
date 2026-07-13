<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Ajouter les FK directes à users
        Schema::table('users', function (Blueprint $table) {
            $table->foreignUuid('role_id')->nullable()->after('phone');
            $table->foreignUuid('agency_id')->nullable()->after('role_id');
            $table->foreignUuid('department_id')->nullable()->after('agency_id');
        });

        // 2. Migrer les données : premier rôle de chaque user → role_id
        $assignments = DB::table('model_has_roles')
            ->where('model_type', 'App\\Models\\User')
            ->select('model_id', 'role_id')
            ->get();

        foreach ($assignments as $a) {
            DB::table('users')
                ->where('id', $a->model_id)
                ->update(['role_id' => $a->role_id]);
        }

        // 3. Migrer les données : première agence de chaque user → agency_id
        $userAgencies = DB::table('user_assignments')
            ->select('user_id', 'agency_id', 'department_id')
            ->orderBy('is_primary', 'desc')
            ->get()
            ->unique('user_id');

        foreach ($userAgencies as $ua) {
            DB::table('users')
                ->where('id', $ua->user_id)
                ->update([
                    'agency_id' => $ua->agency_id,
                    'department_id' => $ua->department_id,
                ]);
        }

        // 4. Rendre role_id NOT NULL après migration des données
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('role_id')->references('id')->on('roles')->nullOnDelete();
            $table->foreign('agency_id')->references('id')->on('agencies')->nullOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });

        // 5. Renommer et supprimer les colonnes obsolètes
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('must_change_password', 'is_password_change_required');
            $table->dropColumn(['is_super_admin']);
        });

        // 6. Supprimer les tables pivot inutiles
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('user_assignments');
    }

    public function down(): void
    {
        // Recréer les tables pivot
        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->foreignUuid('role_id')->constrained()->cascadeOnDelete();
            $table->uuid('model_id');
            $table->string('model_type');
            $table->index(['model_id', 'model_type']);
            $table->primary(['role_id', 'model_id', 'model_type']);
        });

        Schema::create('user_assignments', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->primary(['user_id', 'agency_id']);
        });

        // Restaurer les colonnes
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_super_admin')->default(false)->after('phone');
            $table->renameColumn('is_password_change_required', 'must_change_password');
            $table->dropForeign(['role_id']);
            $table->dropForeign(['agency_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['role_id', 'agency_id', 'department_id']);
        });
    }
};
