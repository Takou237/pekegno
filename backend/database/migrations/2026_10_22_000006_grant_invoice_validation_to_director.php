<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le directeur général valide les factures en attente de son pays (le
 * périmètre pays est appliqué par les contrôleurs).
 */
return new class extends Migration
{
    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'invoices.valider')->value('id');
        $roleId = DB::table('roles')->where('name', 'direction-generale')->value('id');

        if (! $permissionId || ! $roleId) {
            return;
        }

        if (! DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permissionId)->exists()) {
            DB::table('role_permission')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'invoices.valider')->value('id');
        $roleId = DB::table('roles')->where('name', 'direction-generale')->value('id');

        DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permissionId)->delete();
    }
};
