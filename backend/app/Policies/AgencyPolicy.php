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
        // La liste est déjà scopée côté contrôleur (ScopeService) : le commercial,
        // le caissier et le community-manager doivent pouvoir résoudre leur agence
        // (formulaire « Nouvelle prestation », sélecteurs) sans 403 global.
        return in_array($user->role?->name, [
            'super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement',
            'commercial', 'caissier', 'comptable', 'community-manager',
        ]);
    }

    public function view(User $user, Agency $agency): bool
    {
        // Administrateurs et direction : accès complet.
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return $this->inDirectorCountry($user, $agency->id);
        }

        // Pour la vente et le catalogue, les rôles opérationnels doivent pouvoir
        // consulter n'importe quelle agence (ex: chef de Douala vendant un produit
        // de Yaoundé). Les restrictions de gestion (update/delete) restent inchangées.
        return in_array($user->role?->name, [
            'responsable-agence', 'responsable-departement', 'commercial',
            'caissier', 'comptable', 'community-manager',
        ]);
    }

    public function create(User $user): bool
    {
        return in_array($user->role?->name, ['super-admin', 'direction-generale']);
    }

    public function update(User $user, Agency $agency): bool
    {
        if (in_array($user->role?->name, ['super-admin', 'direction-generale'])) {
            return $this->inDirectorCountry($user, $agency->id);
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
