<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Le commercial doit pouvoir créer des prestations (offres + souscriptions)
     * depuis l'onglet Packages du catalogue, sans toast 403.
     */
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'commercial')->value('id');
        if (! $roleId) {
            return;
        }

        $wanted = [
            'prestations.consulter',
            'prestations.creer',
            'packages.consulter',
            'countries.consulter',
        ];

        $permIds = DB::table('permissions')->whereIn('name', $wanted)->pluck('id', 'name');

        foreach ($wanted as $name) {
            $permId = $permIds[$name] ?? null;
            if ($permId && ! DB::table('role_permission')->where('role_id', $roleId)->where('permission_id', $permId)->exists()) {
                DB::table('role_permission')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permId,
                ]);
            }
        }
    }

    public function down(): void
    {
        // On ne retire pas les droits en rollback : création uniquement.
    }
};
