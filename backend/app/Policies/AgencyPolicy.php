<?php

namespace App\Policies;

use App\Models\Agency;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class AgencyPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
        ]);
    }

    public function view(User $user, Agency $agency): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return true;
        }

        if ($user->role?->name === 'responsable-agence') {
            return $user->assignments()->where('agency_id', $agency->id)->exists();
        }

        return false;
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale']);
    }

    public function update(User $user, Agency $agency): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return true;
        }

        if ($user->role?->name === 'responsable-agence') {
            return $user->assignments()
                ->where('agency_id', $agency->id)
                ->where('is_primary', true)
                ->exists();
        }

        return false;
    }

    public function delete(User $user): bool
    {
        return $user->role?->name === 'super-admin';
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
