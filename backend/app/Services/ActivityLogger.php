<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;

class ActivityLogger
{
    public function log(
        string $action,
        string $entityType,
        ?string $entityId = null,
        ?string $description = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?Request $request = null,
        ?string $agencyId = null,
        ?string $countryId = null,
    ): ActivityLog {
        $request ??= request();
        $user = $request->user();

        return ActivityLog::create([
            'user_id' => $user?->id,
            'agency_id' => $agencyId ?? $this->resolveAgencyId($user, $entityType, $entityId),
            'country_id' => $countryId ?? $this->resolveCountryId($user, $entityType, $entityId),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'description' => $description,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    /**
     * L'agence affichée dans l'audit est l'agence de l'entité concernée par
     * l'action (facture, commande, agence elle-même) ; à défaut, on retombe sur
     * l'agence de l'utilisateur qui agit (affectation principale, sinon n'importe
     * quelle affectation, sinon son profil commercial). Ainsi, peu importe que le
     * contrôleur ait passé ou non un agencyId explicite, la valeur est correcte.
     */
    private function resolveAgencyId(?User $user, string $entityType, ?string $entityId): ?string
    {
        if ($entityId) {
            $agencyId = $this->entityAgencyId($entityType, $entityId);

            if ($agencyId) {
                return $agencyId;
            }
        }

        return $user?->primaryAgency()->value('agencies.id')
            ?? $user?->assignments()->value('agencies.id')
            ?? $user?->commercialProfile?->agency_id;
    }

    private function entityAgencyId(string $entityType, string $entityId): ?string
    {
        return match ($entityType) {
            'invoice' => Invoice::whereKey($entityId)->value('agency_id'),
            'order' => Order::whereKey($entityId)->value('agency_id'),
            'agency' => $entityId,
            default => null,
        };
    }

    /**
     * Le pays affiché dans l'audit est celui du client concerné (profil), et non
     * celui de l'agence de la transaction (qui peut différer d'un pays à l'autre).
     * On le déduit de l'entité journalisée (facture/commande/client) ; si le client
     * n'est pas renseigné ou n'a pas de pays, on retombe sur le pays de l'agence de
     * l'entité, puis sur le pays de l'utilisateur qui agit.
     */
    private function resolveCountryId(?User $user, string $entityType, ?string $entityId): ?string
    {
        $clientId = null;
        $agencyCountryId = null;

        if ($entityId) {
            $entityAgencyId = null;

            if ($entityType === 'client') {
                $clientId = $entityId;
            } elseif ($entityType === 'invoice' || $entityType === 'order') {
                $model = $entityType === 'invoice' ? Invoice::query() : Order::query();
                $clientId = $model->whereKey($entityId)->value('client_id');
                $entityAgencyId = $this->entityAgencyId($entityType, $entityId);
            } elseif ($entityType === 'agency') {
                $entityAgencyId = $entityId;
            }

            if ($entityAgencyId) {
                $agencyCountryId = Agency::whereKey($entityAgencyId)->value('country_id');
            }
        }

        if ($clientId) {
            $countryId = User::whereKey($clientId)->value('country_id');
            if ($countryId) {
                return $countryId;
            }
        }

        return $agencyCountryId ?? $this->resolveUserCountry($user);
    }

    private function resolveUserCountry(?User $user): ?string
    {
        return $user?->country_id
            ?? $user?->primaryAgency()->value('agencies.country_id')
            ?? $user?->assignments()->value('agencies.country_id')
            ?? $user?->commercialProfile?->agency?->country_id;
    }
}
