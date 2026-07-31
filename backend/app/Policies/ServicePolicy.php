<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;
use Illuminate\Support\Facades\DB;

class ServicePolicy
{
    use HandlesAuthorization;

    private const MANAGER_ROLES = [
        'super-admin',
        'direction-generale',
        'responsable-agence',
        'responsable-departement',
    ];

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Service $service): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, self::MANAGER_ROLES);
    }

    public function update(User $user, Service $service): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return true;
        }

        if ($user->role?->name === 'responsable-agence') {
            $agencyId = $service->agency_id ?? $service->department?->agency_id;

            return $agencyId && $user->assignments()
                ->where('agency_id', $agencyId)
                ->where('is_primary', true)
                ->exists();
        }

        if ($user->role?->name === 'responsable-departement') {
            $departmentId = $service->department_id;

            return $departmentId && DB::table('department_chiefs')
                ->where('department_id', $departmentId)
                ->where('user_id', $user->id)
                ->exists();
        }

        return false;
    }

    public function delete(User $user, Service $service): bool
    {
        return $this->update($user, $service);
    }

    public function restore(User $user): bool
    {
        return $user->role?->name === 'super-admin';
    }

    public function forceDelete(User $user): bool
    {
        return $user->role?->name === 'super-admin';
    }
}
