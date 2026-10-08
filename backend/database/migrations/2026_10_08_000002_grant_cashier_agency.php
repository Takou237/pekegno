<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * K1 (doc/TODO_Agency.md §6) : le caissier doit pouvoir souscrire des packages,
 * et créer + valider directement les prestations de son périmètre.
 *
 * La route `POST /packages/{id}/subscribe` exige `prestations.creer`, et la
 * validation exige `prestations.valider` — on accorde donc ces permissions au
 * rôle « caissier » existant, idempotemment (même approche que la migration
 * 2026_10_03_000011_grant_agency_permissions).
 */
return new class extends Migration
{
    private const ROLE = 'caissier';

    private const GRANTS = [
        'prestations.creer',
        'prestations.valider',
        'prestation-actions.consulter',
    ];

    public function up(): void
    {
        if (DB::table('roles')->doesntExist()) {
            return; // base vide : les seeders s'en chargeront
        }

        $roleId = DB::table('roles')->where('name', self::ROLE)->value('id');
        if (! $roleId) {
            return;
        }

        foreach (self::GRANTS as $permissionName) {
            $permissionId = DB::table('permissions')->where('name', $permissionName)->value('id');
            if (! $permissionId) {
                continue;
            }

            $exists = DB::table('role_permission')
                ->where('role_id', $roleId)
                ->where('permission_id', $permissionId)
                ->exists();

            if (! $exists) {
                DB::table('role_permission')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Permissions conservées : les retirer casserait les écrans Agency.
    }
};
