<?php

namespace App\Policies;

use App\Models\Department;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class DepartmentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, [
            'super-admin',
            'direction-generale',
            'responsable-agence',
            'responsable-departement',
            'commercial',
            'caissier',
            'community-manager',
        ]);
    }

    public function view(User $user, Department $department): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return $this->inDirectorCountry($user, $department->agency_id);
        }

        if ($user->role?->name === 'responsable-agence') {
            return $user->assignments()
                ->where('agency_id', $department->agency_id)
                ->exists();
        }

        if ($user->role?->name === 'responsable-departement') {
            return $this->isChiefOf($user, $department);
        }

        if (in_array($user->role?->name, ['commercial', 'caissier', 'community-manager'], true)) {
            $agencyIds = app(\App\Services\ScopeService::class)->agencyIds($user);
            if ($agencyIds === null) {
                return true;
            }

            return in_array($department->agency_id, $agencyIds, true);
        }

        return false;
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence']);
    }

    public function update(User $user, Department $department): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return $this->inDirectorCountry($user, $department->agency_id);
        }

        if ($user->role?->name === 'responsable-agence') {
            return $user->assignments()
                ->where('agency_id', $department->agency_id)
                ->where('is_primary', true)
                ->exists();
        }

        if ($user->role?->name === 'responsable-departement') {
            return $this->isChiefOf($user, $department);
        }

        return false;
    }

    public function delete(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale']);
    }

    public function restore(User $user): bool
    {
        return $user->role?->name === 'super-admin';
    }

    public function forceDelete(User $user): bool
    {
        return $user->role?->name === 'super-admin';
    }

    /**
     * Chef du département : nommé dans department_chiefs ou marqué
     * is_department_chief sur son affectation.
     */
    private function isChiefOf(User $user, Department $department): bool
    {
        if (\Illuminate\Support\Facades\DB::table('department_chiefs')
            ->where('user_id', $user->id)
            ->where('department_id', $department->id)
            ->exists()) {
            return true;
        }

        return $user->assignments()
            ->wherePivot('department_id', $department->id)
            ->wherePivot('is_department_chief', true)
            ->exists();
    }

    /** Directeur général rattaché à un pays : uniquement les agences de ce pays. */
    private function inDirectorCountry(User $user, ?string $agencyId): bool
    {
        $scope = app(\App\Services\ScopeService::class);

        if ($scope->directorCountryId($user) === null) {
            return true;
        }

        return in_array($agencyId, $scope->agencyIds($user) ?? [], true);
    }
}
