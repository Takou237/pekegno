<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Agency : crée les permissions packages / prestations / prestation-actions /
 * equipe-client, le rôle applicatif « community-manager », et les attribue
 * aux rôles existants. Le RoleSeeder ne tourne pas sur une base existante
 * (cf. 2026_09_29_000001_grant_cashier_commission_payment).
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'packages.consulter' => 'Consulter : les packages Agency',
        'packages.creer' => 'Créer : les packages Agency',
        'packages.modifier' => 'Modifier : les packages Agency',
        'packages.supprimer' => 'Supprimer : les packages Agency',
        'prestations.consulter' => 'Consulter : les prestations Agency',
        'prestations.creer' => 'Créer : les prestations Agency',
        'prestations.modifier' => 'Modifier : les prestations Agency',
        'prestations.supprimer' => 'Supprimer : les prestations Agency',
        'prestations.valider' => 'Valider : les prestations Agency',
        'prestations.exporter' => 'Exporter : les prestations Agency',
        'prestation-actions.consulter' => 'Consulter : les actions des prestations',
        'prestation-actions.creer' => 'Créer : les actions des prestations',
        'prestation-actions.modifier' => 'Modifier : les actions des prestations',
        'prestation-actions.supprimer' => 'Supprimer : les actions des prestations',
        'equipe-client.consulter' => "Consulter : l'équipe client Agency",
        'equipe-client.gerer' => "Gérer : l'équipe client Agency",
    ];

    private const GRANTS = [
        'super-admin' => '*',
        'direction-generale' => '*',
        'responsable-agence' => '*',
        'responsable-departement' => [
            'packages.consulter', 'packages.creer', 'packages.modifier',
            'prestations.consulter', 'prestations.creer', 'prestations.modifier', 'prestations.exporter',
            'prestation-actions.consulter', 'prestation-actions.creer', 'prestation-actions.modifier', 'prestation-actions.supprimer',
            'equipe-client.consulter', 'equipe-client.gerer',
        ],
        'commercial' => [
            'packages.consulter', 'prestations.consulter', 'prestations.creer',
            'prestation-actions.consulter', 'equipe-client.consulter',
        ],
        'caissier' => ['packages.consulter', 'prestations.consulter', 'contrats.consulter'],
        'comptable' => ['packages.consulter', 'prestations.consulter', 'prestations.exporter'],
        'community-manager' => [
            'clients.consulter', 'packages.consulter', 'prestations.consulter',
            'prestation-actions.consulter', 'prestation-actions.modifier', 'equipe-client.consulter',
        ],
    ];

    public function up(): void
    {
        if (DB::table('roles')->doesntExist()) {
            return; // base vide : les seeders s'en chargeront
        }

        foreach (self::PERMISSIONS as $name => $description) {
            if (DB::table('permissions')->where('name', $name)->doesntExist()) {
                DB::table('permissions')->insert([
                    'id' => (string) Str::uuid(),
                    'name' => $name,
                    'description' => $description,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        if (DB::table('roles')->where('name', 'community-manager')->doesntExist()) {
            DB::table('roles')->insert([
                'id' => (string) Str::uuid(),
                'name' => 'community-manager',
                'description' => 'Exécute les prestations Agency auxquelles il est affecté',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $permissionIds = DB::table('permissions')->pluck('id', 'name');

        foreach (self::GRANTS as $roleName => $names) {
            $roleId = DB::table('roles')->where('name', $roleName)->value('id');
            if (! $roleId) {
                continue;
            }

            $names = $names === '*' ? array_keys(self::PERMISSIONS) : $names;

            foreach ($names as $name) {
                $permissionId = $permissionIds[$name] ?? null;
                if (! $permissionId) {
                    continue;
                }

                $exists = DB::table('role_permission')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permissionId)
                    ->exists();

                if (! $exists) {
                    DB::table('role_permission')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
                }
            }
        }
    }

    public function down(): void
    {
        // Permissions conservées : les retirer casserait les écrans Agency.
    }
};
