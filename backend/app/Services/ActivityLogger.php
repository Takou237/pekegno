<?php

namespace App\Services;

use App\Models\ActivityLog;
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
            'agency_id' => $agencyId ?? $this->resolveAgencyId($user),
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

    private function resolveAgencyId(?User $user): ?string
    {
        return $user?->primaryAgency()->value('agencies.id');
    }

    /**
     * Le pays affiché dans l'audit est celui du client concerné (profil), et non
     * celui de l'agence de la transaction (qui peut différer d'un pays à l'autre).
     * On le déduit de l'entité journalisée (facture/commande/client) ; à défaut,
     * on retombe sur le pays de l'utilisateur qui agit.
     */
    private function resolveCountryId(?User $user, string $entityType, ?string $entityId): ?string
    {
        $clientId = null;

        if ($entityId) {
            $clientId = match ($entityType) {
                'invoice' => Invoice::whereKey($entityId)->value('client_id'),
                'order' => Order::whereKey($entityId)->value('client_id'),
                'client' => $entityId,
                default => null,
            };
        }

        if ($clientId) {
            $countryId = User::whereKey($clientId)->value('country_id');
            if ($countryId) {
                return $countryId;
            }
        }

        return $user?->country_id;
    }
}
