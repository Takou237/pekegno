<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Périmètre d'accès aux prestations Agency, en plus du périmètre
 * organisationnel (ScopeService) :
 * - commercial : uniquement les prestations qu'il a vendues ;
 * - community-manager : uniquement celles où il est dans l'équipe ou assigné à une action.
 */
class AgencyAccessService
{
    public function __construct(private readonly ScopeService $scope) {}

    public function scopePrestations(Builder $query, ?User $user): Builder
    {
        $agencyIds = $this->scope->agencyIds($user);

        if ($agencyIds !== null) {
            $query->whereIn('prestations.agency_id', $agencyIds);
        }

        return match ($user?->role?->name) {
            'commercial' => $query->whereIn('prestations.commercial_id', $this->commercialIds($user)),
            'community-manager' => $query->where(function (Builder $q) use ($user) {
                $q->whereHas('teamMembers', fn (Builder $m) => $m->where('user_id', $user->id))
                    ->orWhereHas('actions', fn (Builder $a) => $a->where('assigned_to', $user->id));
            }),
            default => $query,
        };
    }

    public function canAccess(?User $user, Prestation $prestation): bool
    {
        return $this->scopePrestations(Prestation::query()->whereKey($prestation->id), $user)->exists();
    }

    /**
     * Périmètre des offres de prestation : catalogue visible par tous les
     * rôles de l'agence (un commercial doit pouvoir souscrire une offre).
     */
    public function scopeOffers(Builder $query, ?User $user): Builder
    {
        $agencyIds = $this->scope->agencyIds($user);

        if ($agencyIds !== null) {
            $query->whereIn('prestation_offers.agency_id', $agencyIds);
        }

        return $query;
    }

    public function canAccessOffer(?User $user, ?string $offerId): bool
    {
        if ($offerId === null) {
            return false;
        }

        return $this->scopeOffers(PrestationOffer::query()->whereKey($offerId), $user)->exists();
    }

    public function authorize(?User $user, Prestation $prestation): void
    {
        abort_unless($this->canAccess($user, $prestation), 403, 'Prestation hors de votre périmètre.');
    }

    /** L'agence est-elle dans le périmètre de l'utilisateur ? */
    public function canAccessAgency(?User $user, ?string $agencyId): bool
    {
        $agencyIds = $this->scope->agencyIds($user);

        return $agencyIds === null || ($agencyId !== null && in_array($agencyId, $agencyIds, true));
    }

    /** @return array<int, string> */
    public function commercialIds(User $user): array
    {
        return Commercial::where('user_id', $user->id)->pluck('id')->all();
    }
}
