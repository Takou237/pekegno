<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Ticket T4 : la caissière paie les commissions (commissions.encaisser).
 * Le RoleSeeder ne tourne pas sur une base existante : sans cette migration,
 * les rôles déjà en base gardaient l'ancienne liste de permissions (403).
 */
return new class extends Migration
{
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'caissier')->value('id');
        $permissionId = DB::table('permissions')->where('name', 'commissions.encaisser')->value('id');

        if (! $roleId || ! $permissionId) {
            return; // base vide : le seeder s'en chargera
        }

        $exists = DB::table('role_permission')
            ->where('role_id', $roleId)
            ->where('permission_id', $permissionId)
            ->exists();

        if (! $exists) {
            DB::table('role_permission')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    public function down(): void
    {
        // Permission conservée : la retirer recasserait le paiement au guichet.
    }
};
