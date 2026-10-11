<?php

namespace App\Services;

use App\Models\SellerProfile;
use App\Models\Setting;
use App\Models\User;

/**
 * Garantit l'existence du profil vendeur d'un membre de l'agence qui vend
 * (formateurs notamment) : les formateurs sont des employés de l'agence, ils
 * peuvent vendre et percevoir des commissions — avec la commission par défaut
 * du réseau (20 %, voir réglages).
 */
class SellerProfileService
{
    public function ensureForUser(User $user, ?string $agencyId = null): ?SellerProfile
    {
        // Seuls les formateurs (employés de l'agence) sont profilés automatiquement ;
        // les commerciaux/employés ont déjà leur mécanique via commercial_id.
        if ($user->role?->name !== 'formateur') {
            return null;
        }

        $agencyId ??= $user->primaryAgency()->value('agencies.id');

        if (! $agencyId) {
            return null;
        }

        $profile = SellerProfile::where('user_id', $user->id)
            ->where('agency_id', $agencyId)
            ->first();

        if ($profile) {
            return $profile;
        }

        return SellerProfile::create([
            'user_id' => $user->id,
            'agency_id' => $agencyId,
            'kind' => SellerProfile::KIND_EMPLOYEE,
            'commission_type' => Setting::get('default_commission_type', 'percent'),
            'commission_value' => Setting::get('default_commission_value', 20),
            'is_active' => true,
        ]);
    }

    public function ensureForTrainer(\App\Models\Trainer $trainer, ?string $agencyId = null): ?SellerProfile
    {
        if (! $trainer->user_id) {
            return null;
        }

        return $this->ensureForUser($trainer->user, $agencyId ?? $trainer->agency_id);
    }
}