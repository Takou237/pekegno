<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Complète le journal d'audit pour les utilisateurs dont l'affectation n'est
 * PAS « principale » (ou qui n'en ont aucune, mais ont un profil commercial) :
 *
 *  1. users.country_id manquant  → pays de l'agence affectée (principale d'abord,
 *     sinon n'importe laquelle, sinon profil commercial) ;
 *  2. activity_logs (agency_id/country_id manquants) → résolution depuis
 *     l'utilisateur qui agit, pour les actions sans entité (login, role, etc.).
 *
 * Les utilisateurs réellement « groupe » (admin global sans agence) restent
 * volontairement avec —.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->syncUserCountries();
        $this->backfillLogsFromActors();
    }

    public function down(): void
    {
        // Rien à annuler : opérations purement correctives.
    }

    private function syncUserCountries(): void
    {
        DB::table('users')->whereNull('country_id')->orderBy('id')->chunkById(500, function ($users) {
            $userIds = $users->pluck('id')->all();
            $agencyByUser = $this->resolveAgencyByUser($userIds);
            $countryByUser = $this->resolveCountryByUser($userIds, $agencyByUser);

            foreach ($users as $user) {
                if (! empty($countryByUser[$user->id])) {
                    DB::table('users')->where('id', $user->id)->update(['country_id' => $countryByUser[$user->id]]);
                }
            }
        });
    }

    private function backfillLogsFromActors(): void
    {
        DB::table('activity_logs')
            ->where(function ($q) {
                $q->whereNull('agency_id')->orWhereNull('country_id');
            })
            ->whereNotNull('user_id')
            ->orderBy('id')
            ->chunkById(500, function ($logs) {
                $userIds = $logs->pluck('user_id')->filter()->unique()->values()->all();

                $agencyByUser = $this->resolveAgencyByUser($userIds);
                $countryByUser = $this->resolveCountryByUser($userIds, $agencyByUser);

                foreach ($logs as $log) {
                    $updates = [];

                    if (! $log->agency_id && ! empty($agencyByUser[$log->user_id])) {
                        $updates['agency_id'] = $agencyByUser[$log->user_id];
                    }

                    if (! $log->country_id) {
                        if (! empty($countryByUser[$log->user_id])) {
                            $updates['country_id'] = $countryByUser[$log->user_id];
                        } elseif (! empty($updates['agency_id'])) {
                            $country = DB::table('agencies')->whereKey($updates['agency_id'])->value('country_id');
                            if ($country) {
                                $updates['country_id'] = $country;
                            }
                        }
                    }

                    if ($updates) {
                        DB::table('activity_logs')->where('id', $log->id)->update($updates);
                    }
                }
            });
    }

    /** Affectation principale d'abord, sinon n'importe laquelle, sinon profil commercial. */
    private function resolveAgencyByUser(array $userIds): array
    {
        $primary = DB::table('user_assignments')
            ->whereIn('user_id', $userIds)
            ->where('is_primary', true)
            ->pluck('agency_id', 'user_id');

        $missing = array_values(array_diff($userIds, $primary->keys()->all()));

        $any = $missing
            ? DB::table('user_assignments')->whereIn('user_id', $missing)->pluck('agency_id', 'user_id')
            : collect();

        $merged = $primary->union($any);

        $stillMissing = array_values(array_diff($userIds, $merged->keys()->all()));

        if ($stillMissing) {
            $commercial = DB::table('commercials')
                ->whereIn('user_id', $stillMissing)
                ->whereNotNull('agency_id')
                ->pluck('agency_id', 'user_id');

            $merged = $merged->union($commercial);
        }

        return $merged->all();
    }

    private function resolveCountryByUser(array $userIds, array $agencyByUser): array
    {
        $countryByUser = DB::table('users')
            ->whereIn('id', $userIds)
            ->pluck('country_id', 'id');

        $missing = array_values(array_diff($userIds, $countryByUser->filter()->keys()->all()));

        if ($missing) {
            $agencyIds = array_values(array_filter(array_map(
                fn (string $uid) => $agencyByUser[$uid] ?? null,
                $missing,
            )));

            $countryByAgency = $agencyIds
                ? DB::table('agencies')->whereIn('id', $agencyIds)->pluck('country_id', 'id')
                : collect();

            foreach ($missing as $uid) {
                if (! empty($countryByUser[$uid])) {
                    continue;
                }

                $agencyId = $agencyByUser[$uid] ?? null;
                if ($agencyId && ! empty($countryByAgency[$agencyId])) {
                    $countryByUser[$uid] = $countryByAgency[$agencyId];
                }
            }
        }

        return $countryByUser->all();
    }
};