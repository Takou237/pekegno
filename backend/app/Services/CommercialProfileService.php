<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Chaque compte de rôle « commercial » doit avoir une ligne dans la table
 * `commercials` (son profil métier : agence, commissions, points, prospects).
 * Sans elle, son tableau de bord répond « aucun profil commercial associé »
 * et l'interface diffère de celle des commerciaux préexistants.
 *
 * Ce service garantit la création de ce profil aux deux endroits où un compte
 * commercial naît : création via l'admin, ou changement de rôle d'un employé
 * existant.
 */
class CommercialProfileService
{
    /**
     * Crée le profil commercial lié au compte s'il n'existe pas déjà.
     * Les infos personnelles sont copiées du compte utilisateur ; l'agence
     * est celle fournie (création avec agence), sinon la première agence du
     * compte, sinon null (rattachable plus tard).
     *
     * Ne fait rien pour les autres rôles (caissier, comptable, etc.) : leurs
     * profils « employé » sont créés à la volée par l'annuaire RH.
     */
    public function ensureFor(User $user, ?string $agencyId = null): ?Commercial
    {
        if ($user->role?->name !== 'commercial') {
            return null;
        }

        $existing = Commercial::withTrashed()->where('user_id', $user->id)->first();

        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($user, $agencyId) {
            // Parcours double : verrou + re-vérification, pour deux créations
            // simultanées du même compte (unique index sur user_id).
            $locked = DB::table('commercials')
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($locked) {
                return Commercial::withTrashed()->findOrFail($locked->id);
            }

            return Commercial::create([
                'user_id' => $user->id,
                'agency_id' => $agencyId
                    ?? $user->assignments()->pluck('agencies.id')->first(),
                'kind' => 'commercial',
                'first_name' => $user->first_name ?: ($user->username ?: 'Commercial'),
                'last_name' => $user->last_name ?: '—',
                'email' => $user->email,
                'phone' => $user->phone,
                // Commission par défaut du réseau : 20 % (réglages).
                'commission_type' => Setting::get('default_commission_type', 'percent'),
                'commission_value' => Setting::get('default_commission_value', 20),
                'points_balance' => 0,
                'is_active' => $user->is_active,
            ]);
        });
    }
}
