<?php

namespace App\Policies;

use App\Models\Module;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ModulePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
            'commercial', 'caissier', 'comptable', 'formateur',
        ]);
    }

    public function view(User $user, Module $module): bool
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

    public function update(User $user, Module $module): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement']);
    }

    public function delete(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement']);
    }
}
