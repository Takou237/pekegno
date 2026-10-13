<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'caissier')->value('id');
        $permId = DB::table('permissions')->where('name', 'prestation-actions.modifier')->value('id');
        if ($roleId && $permId && ! DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permId)->exists()) {
            DB::table('role_permission')->insert([
                'role_id' => $roleId,
                'permission_id' => $permId,
            ]);
        }
    }

    public function down(): void
    {
        $roleId = DB::table('roles')->where('name', 'caissier')->value('id');
        $permId = DB::table('permissions')->where('name', 'prestation-actions.modifier')->value('id');
        if ($roleId && $permId) {
            DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permId)->delete();
        }
    }
};
