<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le community-manager dispose de toutes les fonctionnalités du commercial
 * (ventes, factures, prospects, opportunités, rapport commercial…) en plus
 * du suivi de ses prestations : il reçoit toutes les permissions du rôle
 * commercial qu'il n'a pas encore.
 */
return new class extends Migration
{
    public function up(): void
    {
        $commercialId = DB::table('roles')->where('name', 'commercial')->value('id');
        $managerId = DB::table('roles')->where('name', 'community-manager')->value('id');

        if (! $commercialId || ! $managerId) {
            return;
        }

        $commercialPerms = DB::table('role_permission')
            ->where('role_id', $commercialId)
            ->pluck('permission_id')
            ->all();

        $existing = DB::table('role_permission')
            ->where('role_id', $managerId)
            ->pluck('permission_id')
            ->all();

        $rows = [];
        foreach (array_diff($commercialPerms, $existing) as $permId) {
            $rows[] = ['role_id' => $managerId, 'permission_id' => $permId];
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
