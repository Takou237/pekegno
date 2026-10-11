<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'caissier')->value('id');

        if (! $roleId) {
            return;
        }

        $names = [
            'comptabilite.creer',
            'comptabilite.modifier',
            'comptabilite.supprimer',
            'comptabilite.exporter',
            'accounting-categories.consulter',
            'accounting-categories.creer',
            'accounting-categories.modifier',
            'accounting-categories.supprimer',
        ];

        $permIds = DB::table('permissions')->whereIn('name', $names)->pluck('id', 'name');
        $existing = DB::table('role_permission')
            ->where('role_id', $roleId)
            ->whereIn('permission_id', $permIds->values())
            ->pluck('permission_id')
            ->all();

        $rows = [];

        foreach ($permIds as $permId) {
            if (! in_array($permId, $existing, true)) {
                $rows[] = ['role_id' => $roleId, 'permission_id' => $permId];
            }
        }

        if ($rows !== []) {
            DB::table('role_permission')->insert($rows);
        }
    }

    public function down(): void
    {
        // On conserve les droits comptables du caissier : pas de retour arrière.
    }
};
