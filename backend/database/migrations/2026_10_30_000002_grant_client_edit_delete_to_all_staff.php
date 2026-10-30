<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Table Clients : tous les rôles qui la consultent peuvent modifier et
 * supprimer un client (boutons d'action visibles pour tous).
 */
return new class extends Migration
{
    public function up(): void
    {
        $roleIds = DB::table('roles')
            ->whereIn('name', ['commercial', 'caissier', 'comptable', 'community-manager'])
            ->pluck('id');

        $permIds = DB::table('permissions')
            ->whereIn('name', ['clients.modifier', 'clients.supprimer'])
            ->pluck('id');

        $rows = [];

        foreach ($roleIds as $roleId) {
            $existing = DB::table('role_permission')
                ->where('role_id', $roleId)
                ->whereIn('permission_id', $permIds)
                ->pluck('permission_id')
                ->all();

            foreach ($permIds as $permId) {
                if (! in_array($permId, $existing, true)) {
                    $rows[] = ['role_id' => $roleId, 'permission_id' => $permId];
                }
            }
        }

        if ($rows !== []) {
            DB::table('role_permission')->insert($rows);
        }
    }

    public function down(): void
    {
        // On conserve les droits accordés : pas de retour arrière.
    }
};
