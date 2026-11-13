<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * T0.6 — décisions client du 12/11/2026.
 *
 * - `community-manager` : exécutant de prestations (option A). Les droits de
 *   vente hérités de `2026_11_03_000001_grant_commercial_permissions_to_community_manager`
 *   sont retirés ; il conserve la lecture du périmètre et l'exécution des
 *   actions qui lui sont attribuées.
 * - `caissier` : matrice validée — plus de suppression de client, comptabilité
 *   en lecture seule (consultation + export).
 *
 * La source de vérité reste `RoleSeeder` ; cette migration aligne les bases
 * déjà installées, qui ne rejouent pas les seeders au déploiement.
 */
return new class extends Migration
{
    private const COMMUNITY_MANAGER = [
        'clients.consulter',
        'services.consulter',
        'products.consulter',
        'categories.consulter',
        'packages.consulter',
        'prestations.consulter',
        'prestation-actions.consulter',
        'prestation-actions.modifier',
        'equipe-client.consulter',
        // Espace formateur (community-manager lié à un profil formateur).
        'courses.consulter',
        'sessions.consulter',
        'enrollments.consulter',
        'presences.consulter',
        'modules.consulter',
    ];

    /** Permissions retirées au caissier. */
    private const CASHIER_REVOKED = [
        'clients.supprimer',
        'comptabilite.creer',
        'comptabilite.modifier',
        'comptabilite.supprimer',
        'accounting-categories.creer',
        'accounting-categories.modifier',
        'accounting-categories.supprimer',
    ];

    public function up(): void
    {
        $roles = DB::table('roles')->whereIn('name', ['community-manager', 'caissier'])->pluck('id', 'name');
        $permissions = DB::table('permissions')->pluck('id', 'name');

        $managerId = $roles['community-manager'] ?? null;
        if ($managerId) {
            DB::table('role_permission')->where('role_id', $managerId)->delete();

            $rows = [];
            foreach (self::COMMUNITY_MANAGER as $name) {
                if (isset($permissions[$name])) {
                    $rows[] = ['role_id' => $managerId, 'permission_id' => $permissions[$name]];
                }
            }

            if ($rows !== []) {
                DB::table('role_permission')->insert($rows);
            }
        }

        $cashierId = $roles['caissier'] ?? null;
        if ($cashierId) {
            $revokedIds = [];
            foreach (self::CASHIER_REVOKED as $name) {
                if (isset($permissions[$name])) {
                    $revokedIds[] = $permissions[$name];
                }
            }

            if ($revokedIds !== []) {
                DB::table('role_permission')
                    ->where('role_id', $cashierId)
                    ->whereIn('permission_id', $revokedIds)
                    ->delete();
            }
        }
    }

    public function down(): void
    {
        // Les restrictions de sécurité ne sont pas annulées automatiquement :
        // il faut rejouer RoleSeeder pour restaurer l'ancienne matrice.
    }
};
