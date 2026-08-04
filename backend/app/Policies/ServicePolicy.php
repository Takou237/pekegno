<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ServicePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
            'commercial', 'caissier', 'comptable', 'formateur',
        ]);
    }

    public function view(User $user, Service $service): bool
    {
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
            'commercial', 'caissier', 'comptable', 'formateur',
        ]);
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement']);
    }

    public function update(User $user, Service $service): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement']);
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
