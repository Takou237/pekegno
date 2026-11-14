<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Remaniement des rôles (14/11) :
 * - « direction-generale » : tout ce que fait le super-admin, sur tout le
 *   groupe, sans voir le super-admin ni ses actions ;
 * - « directeur » (nouveau) : le rôle auquel on attribue un pays.
 * Les directeurs généraux qui avaient un pays deviennent directeurs.
 */
return new class extends Migration
{
    public function up(): void
    {
        $dg = DB::table('roles')->where('name', 'direction-generale')->first();

        $directorId = DB::table('roles')->where('name', 'directeur')->value('id');
        if (! $directorId) {
            $directorId = (string) Str::uuid();
            DB::table('roles')->insert([
                'id' => $directorId,
                'name' => 'directeur',
                'description' => 'Dirige le pays qui lui est attribué (agences, équipes, comptabilité de ce pays)',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($dg) {
            // Mêmes permissions que la direction générale.
            $existing = DB::table('role_permission')->where('role_id', $directorId)->pluck('permission_id')->all();
            $rows = DB::table('role_permission')->where('role_id', $dg->id)->pluck('permission_id')
                ->diff($existing)
                ->map(fn ($pid) => ['role_id' => $directorId, 'permission_id' => $pid])
                ->values()->all();
            if ($rows !== []) {
                DB::table('role_permission')->insert($rows);
            }

            // Un directeur général rattaché à un pays devient directeur de ce pays.
            DB::table('users')->where('role_id', $dg->id)->whereNotNull('country_id')->update(['role_id' => $directorId, 'updated_at' => now()]);

            DB::table('roles')->where('id', $dg->id)->update([
                'description' => 'Pilote tout le groupe (mêmes pouvoirs que le super-admin, sans voir le super-admin)',
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Pas de retour automatique (les comptes directeurs gardent leur rôle).
    }
};
