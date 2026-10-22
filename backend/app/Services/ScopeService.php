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
 * - Le super-admin voit toute l'organisation.
 * - Le directeur général rattaché à un pays (users.country_id) ne voit que les
 *   agences de ce pays ; sans pays, il garde la vue groupe.
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

        if ($this->directorCountryId($user) !== null) {
            return false;
        }

        return in_array($user->role?->name, self::GLOBAL_ROLES, true);
    }

    /**
     * Pays du directeur général (son périmètre), null pour tout autre rôle ou
     * un directeur sans pays attribué.
     */
    public function directorCountryId(?User $user): ?string
    {
        if ($user?->role?->name !== 'direction-generale') {
            return null;
        }

        return $user->country_id ?: null;
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

        if ($countryId = $this->directorCountryId($user)) {
            return Agency::where('country_id', $countryId)->pluck('id')->all();
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

    /** Rôles d'encadrement dont les listes sont limitées à leur espace. */
    private const MANAGER_ROLES = ['responsable-agence', 'responsable-departement', 'direction-generale'];

    /**
     * Restreint une requête (colonne agence) au périmètre d'un chef d'agence,
     * chef de département ou directeur général rattaché à un pays. Sans effet
     * pour les autres rôles, dont les contrôleurs gèrent déjà le périmètre.
     */
    public function scopeManagerQuery($query, ?User $user, string $column = 'agency_id')
    {
        if (! $user || ! in_array($user->role?->name, self::MANAGER_ROLES, true)) {
            return $query;
        }

        $agencyIds = $this->agencyIds($user);

        return $agencyIds === null ? $query : $query->whereIn($column, $agencyIds);
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