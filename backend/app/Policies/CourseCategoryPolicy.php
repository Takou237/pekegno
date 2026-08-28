<?php

namespace App\Policies;

use App\Models\CourseCategory;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class CourseCategoryPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
            'commercial', 'caissier', 'comptable', 'formateur', 'client',
        ]);
    }

    public function view(User $user, CourseCategory $courseCategory): bool
    {
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
            'commercial', 'caissier', 'comptable', 'formateur', 'client',
        ]);
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement']);
    }

    public function update(User $user, CourseCategory $courseCategory): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement']);
    }

    public function delete(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale']);
    }
}