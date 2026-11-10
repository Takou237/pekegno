<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Cahier §2 : la caissière voit sa caisse espèces (C) et la clôture chaque
     * jour. Le droit n'était accordé que par le RoleSeeder : une base existante
     * (non réensemencée) laissait la caissière sur « Caisses du jour » avec
     * « droits insuffisants » et aucune caisse. Rejouable.
     */
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'caissier')->value('id');
        if (! $roleId) {
            return;
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('name', ['tresories.consulter', 'tresories.modifier'])
            ->pluck('id');

        foreach ($permissionIds as $permissionId) {
            DB::table('role_permission')->insertOrIgnore([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
            ]);
        }
    }

    public function down(): void
    {
        // Pas de retrait : le RoleSeeder accorde aussi ces droits.
    }
};
