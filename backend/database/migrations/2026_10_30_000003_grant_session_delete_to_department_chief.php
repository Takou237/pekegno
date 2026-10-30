<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le chef de département supprime les sessions de formation, comme le chef d'agence.
 */
return new class extends Migration
{
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'responsable-departement')->value('id');
        $permId = DB::table('permissions')->where('name', 'sessions.supprimer')->value('id');

        if (! $roleId || ! $permId) {
            return;
        }

        $exists = DB::table('role_permission')
            ->where('role_id', $roleId)
            ->where('permission_id', $permId)
            ->exists();

        if (! $exists) {
            DB::table('role_permission')->insert(['role_id' => $roleId, 'permission_id' => $permId]);
        }
    }

    public function down(): void
    {
        // On conserve le droit accordé : pas de retour arrière.
    }
};
