<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Périmètre d'accès organisationnel (§3 — L'application doit appliquer le périmètre côté backend).
 *
 * Règles :
 * - Les rôles de direction (super-admin, direction-generale) voient tout l'organisation.
 * - Tout autre utilisateur est limité aux agences auxquelles il est affecté
 *   (user_assignments, chef de département, commercial rattaché à une agence).
 * - Les pays et villes autorisés sont dérivés des agences autorisées.
 */
class ScopeService
{
    private const GLOBAL_ROLES = ['super-admin', 'direction-generale'];

    public function isGlobal(?User $user): bool
    {
        if (! $user) {
            return true;
        }

        return in_array($user->role?->name, self::GLOBAL_ROLES, true);
    }

    /**
     * Identifiants d'agences autorisées, null = toutes.
     *
     * @return array<int, string>|null
     */
    public function agencyIds(?User $user): ?array
    {
        if ($this->isGlobal($user)) {
            return null;
        }

        $ids = collect([]);

        $ids = $ids->merge(
            DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->pluck('agency_id')
        );

        $ids = $ids->merge(
            DB::table('department_chiefs')
                ->where('user_id', $user->id)
                ->join('departments', 'departments.id', '=', 'department_chiefs.department_id')
                ->pluck('departments.agency_id')
        );

        $ids = $ids->merge(
            DB::table('commercials')
                ->where('user_id', $user->id)
                ->whereNotNull('agency_id')
                ->pluck('agency_id')
        );

        $ids = $ids->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return null;
        }

        return $ids->all();
    }

    /**
     * Identifiants de pays autorisés, null = tous.
     *
     * @return array<int, string>|null
     */
    public function countryIds(?User $user): ?array
    {
        $agencyIds = $this->agencyIds($user);

        if ($agencyIds === null) {
            return null;
        }

        $ids = Agency::whereIn('id', $agencyIds)
            ->whereNotNull('country_id')
            ->pluck('country_id')
            ->unique()
            ->values();

        return $ids->isEmpty() ? [] : $ids->all();
    }

    /**
     * Identifiants de villes autorisées, null = toutes.
     *
     * @return array<int, string>|null
     */
    public function cityIds(?User $user): ?array
    {
        $agencyIds = $this->agencyIds($user);

        if ($agencyIds === null) {
            return null;
        }

        $ids = Agency::whereIn('id', $agencyIds)
            ->whereNotNull('city_id')
            ->pluck('city_id')
            ->unique()
            ->values();

        return $ids->isEmpty() ? [] : $ids->all();
    }
}