<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Console\Command;

/**
 * Journal d'audit : complète le pays et l'agence des lignes qui n'en ont pas
 * (connexions / déconnexions écrites sans les règles d'ActivityLogger).
 * Agence : celle de l'utilisateur ; pays : celui de l'agence, sinon de
 * l'utilisateur. Simulation par défaut ; --apply écrit. Rejouable.
 */
class FillAuditPlaces extends Command
{
    protected $signature = 'audit:fill-places {--apply : Écrire les corrections (sinon simulation)}';

    protected $description = "Complète le pays et l'agence manquants du journal d'audit";

    public function handle(ActivityLogger $logger): int
    {
        $apply = (bool) $this->option('apply');
        $agencyCountry = Agency::pluck('country_id', 'id');
        $users = [];
        $changed = 0;

        ActivityLog::query()
            ->whereNotNull('user_id')
            ->where(fn ($q) => $q->whereNull('agency_id')->orWhereNull('country_id'))
            ->chunkById(500, function ($logs) use ($logger, $agencyCountry, &$users, &$changed, $apply) {
                foreach ($logs as $log) {
                    $user = $users[$log->user_id] ??= User::find($log->user_id);
                    $agencyId = $log->agency_id ?? $logger->agencyForUser($user);
                    $countryId = $log->country_id
                        ?? ($agencyId ? $agencyCountry[$agencyId] ?? null : null)
                        ?? $logger->countryForUser($user);

                    if ($agencyId === $log->agency_id && $countryId === $log->country_id) {
                        continue;
                    }

                    $changed++;
                    if ($apply) {
                        $log->forceFill(['agency_id' => $agencyId, 'country_id' => $countryId])->saveQuietly();
                    }
                }
            });

        $this->info(sprintf('%d ligne(s) du journal %s.%s', $changed, $apply ? 'complétée(s)' : 'à compléter', $apply ? '' : ' (SIMULATION — relancer avec --apply)'));

        return self::SUCCESS;
    }
}
