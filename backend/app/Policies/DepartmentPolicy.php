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
        ]);
    }

    public function view(User $user, Department $department): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return true;
        }

        if ($user->role?->name === 'responsable-agence') {
            return $user->assignments()
                ->where('agency_id', $department->agency_id)
                ->exists();
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
            return true;
        }

        if ($user->role?->name === 'responsable-agence') {
            return $user->assignments()
                ->where('agency_id', $department->agency_id)
                ->where('is_primary', true)
                ->exists();
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
}
