<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Agence d'une vente (facture). Le bilan du jour, la caisse et la comptabilité
 * filtrent sur invoices.agency_id : une facture sans agence n'apparaît nulle
 * part. Cas réel : inscription à une formation globale (sans agence) saisie
 * par un admin sans agence pour un caissier vendeur — la facture restait
 * orpheline alors que le vendeur, lui, a une agence.
 *
 * Ordre : agence explicite (formation, écran de saisie) → agence du vendeur
 * (commercial, utilisateur, formateur) → agence de l'utilisateur connecté.
 */
class SaleAgencyResolver
{
    public function resolve(
        ?string $explicitAgencyId,
        User $actor,
        ?string $commercialId = null,
        ?string $sellerUserId = null,
        ?string $sellerTrainerId = null,
    ): ?string {
        if ($explicitAgencyId) {
            return $explicitAgencyId;
        }

        if ($commercialId && ($agencyId = Commercial::whereKey($commercialId)->value('agency_id'))) {
            return $agencyId;
        }

        if ($sellerUserId && $sellerUserId !== $actor->id && ($agencyId = $this->forUser(User::find($sellerUserId)))) {
            return $agencyId;
        }

        if ($sellerTrainerId && ($agencyId = Trainer::whereKey($sellerTrainerId)->value('agency_id'))) {
            return $agencyId;
        }

        return $this->forUser($actor);
    }

    /** Agence d'un utilisateur : profil vendeur, sinon affectation (principale d'abord). */
    public function forUser(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        return $user->commercialProfile?->agency_id
            ?? DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->whereNotNull('agency_id')
                ->orderByDesc('is_primary')
                ->value('agency_id');
    }
}
