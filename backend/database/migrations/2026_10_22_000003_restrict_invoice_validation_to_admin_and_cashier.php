<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'invoices.valider')->value('id');
        if (! $permissionId) {
            return;
        }

        $allowedRoleIds = DB::table('roles')
            ->whereIn('name', ['super-admin', 'caissier'])
            ->pluck('id');

        DB::table('role_permission')
            ->where('permission_id', $permissionId)
            ->whereNotIn('role_id', $allowedRoleIds)
            ->delete();

        foreach ($allowedRoleIds as $roleId) {
            if (! DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permissionId)->exists()) {
                DB::table('role_permission')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'invoices.valider')->value('id');
        if (! $permissionId) {
            return;
        }

        $restoredRoleIds = DB::table('roles')
            ->whereIn('name', ['direction-generale', 'responsable-agence'])
            ->pluck('id');

        foreach ($restoredRoleIds as $roleId) {
            if (! DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permissionId)->exists()) {
                DB::table('role_permission')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }
};
