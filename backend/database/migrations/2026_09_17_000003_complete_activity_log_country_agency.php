<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rehausse la fiabilité des colonnes Pays/Agence du journal d'audit :
 *
 *  1. users.country_id manquant  → pays de l'agence principale de l'utilisateur ;
 *  2. activity_logs.agency_id manquant (factures/commandes) → agence de l'entité ;
 *  3. activity_logs.country_id manquant → pays du client, sinon pays de l'agence.
 *
 * Le champ Pays de l'audit reste prioritairement le pays du client concerné ;
 * on ne fait que combler les trous (logs antérieurs, clients sans pays).
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->syncUserCountriesFromPrimaryAgency();
        $this->backfillAgenciesFromEntities();
        $this->backfillCountriesFromAgencies();
    }

    public function down(): void
    {
        // Rien à annuler : opérations purement correctives.
    }

    private function syncUserCountriesFromPrimaryAgency(): void
    {
        DB::table('users')
            ->whereNull('country_id')
            ->orderBy('id')
            ->chunkById(500, function ($users) {
                $userIds = $users->pluck('id')->all();

                $primaryAgencies = DB::table('user_assignments')
                    ->whereIn('user_id', $userIds)
                    ->where('is_primary', true)
                    ->pluck('agency_id', 'user_id');

                $agencyIds = $primaryAgencies->unique()->values()->filter()->all();

                $countryByAgency = $agencyIds
                    ? DB::table('agencies')->whereIn('id', $agencyIds)->pluck('country_id', 'id')
                    : collect();

                foreach ($users as $user) {
                    $agencyId = $primaryAgencies[$user->id] ?? null;
                    $countryId = $agencyId ? ($countryByAgency[$agencyId] ?? null) : null;

                    if ($countryId) {
                        DB::table('users')->where('id', $user->id)->update(['country_id' => $countryId]);
                    }
                }
            });
    }

    private function backfillAgenciesFromEntities(): void
    {
        foreach (['invoice' => 'invoices', 'order' => 'orders'] as $entityType => $table) {
            DB::table('activity_logs')
                ->where('entity_type', $entityType)
                ->whereNull('agency_id')
                ->orderBy('id')
                ->chunkById(500, function ($logs) use ($table) {
                    $entityIds = $logs->pluck('entity_id')->filter()->unique()->values()->all();

                    $agencyByEntity = $entityIds
                        ? DB::table($table)->whereIn('id', $entityIds)->pluck('agency_id', 'id')
                        : collect();

                    foreach ($logs as $log) {
                        $agencyId = $agencyByEntity[$log->entity_id] ?? null;

                        if ($agencyId) {
                            DB::table('activity_logs')->where('id', $log->id)->update(['agency_id' => $agencyId]);
                        }
                    }
                });
        }
    }

    private function backfillCountriesFromAgencies(): void
    {
        DB::table('activity_logs')
            ->whereNull('country_id')
            ->whereNotNull('agency_id')
            ->orderBy('id')
            ->chunkById(500, function ($logs) {
                $agencyIds = $logs->pluck('agency_id')->filter()->unique()->values()->all();

                $countryByAgency = $agencyIds
                    ? DB::table('agencies')->whereIn('id', $agencyIds)->pluck('country_id', 'id')
                    : collect();

                foreach ($logs as $log) {
                    $countryId = $countryByAgency[$log->agency_id] ?? null;

                    if ($countryId) {
                        DB::table('activity_logs')->where('id', $log->id)->update(['country_id' => $countryId]);
                    }
                }
            });
    }
};