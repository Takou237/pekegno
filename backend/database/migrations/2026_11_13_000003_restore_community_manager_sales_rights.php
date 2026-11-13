<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le community manager est un employé qui vend comme les autres (décision
 * client du 13/11, annule T0.6 « exécutant sans vente ») : il reçoit tous les
 * droits du commercial, en plus de ses droits d'exécution de prestations.
 */
return new class extends Migration
{
    private const EXTRA = [
        'clients.consulter', 'clients.modifier',
        'packages.consulter', 'prestations.consulter',
        'prestation-actions.consulter', 'prestation-actions.modifier',
        'equipe-client.consulter',
        'courses.consulter', 'sessions.consulter', 'enrollments.consulter', 'presences.consulter', 'modules.consulter',
    ];

    public function up(): void
    {
        $roles = DB::table('roles')->whereIn('name', ['commercial', 'community-manager'])->pluck('id', 'name');
        if (! isset($roles['commercial'], $roles['community-manager'])) {
            return;
        }

        $wanted = DB::table('role_permission')->where('role_id', $roles['commercial'])->pluck('permission_id')
            ->merge(DB::table('permissions')->whereIn('name', self::EXTRA)->pluck('id'))
            ->unique();
        $current = DB::table('role_permission')->where('role_id', $roles['community-manager'])->pluck('permission_id');

        $rows = $wanted->diff($current)->map(fn ($id) => ['role_id' => $roles['community-manager'], 'permission_id' => $id])->values()->all();
        if ($rows !== []) {
            DB::table('role_permission')->insert($rows);
        }
    }

    public function down(): void
    {
        // Pas de retrait automatique de droits.
    }
};
