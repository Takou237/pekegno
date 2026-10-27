<?php

namespace App\Services;

use App\Models\Commercial;
use App\Models\Setting;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
     * Ne fait rien pour les autres rôles (caissier, comptable, etc.)
     */
    public function ensureFor(User $user, ?string $agencyId = null): ?Commercial
    {
        if ($user->role?->name !== 'commercial') {
            return null;
        }

        return $this->ensureForAny($user, $agencyId);
    }

    /**
     * Crée la fiche vendeur d'un compte sans fiche, quel que soit son rôle :
     * « commercial » le cas échéant, sinon une fiche « employé » (comme les
     * profils créés par l'annuaire RH). Utilisée quand l'utilisateur attribue
     * une vente à n'importe quel compte du staff.
     */
    public function ensureForAny(User $user, ?string $agencyId = null): Commercial
    {
        $existing = Commercial::withTrashed()->where('user_id', $user->id)->first();

        if ($existing) {
            return $existing;
        }

        $kind = $user->role?->name === 'commercial' ? 'commercial' : 'employe';

        return DB::transaction(function () use ($user, $agencyId, $kind) {
            // Parcours double : verrou + re-vérification (index unique user_id).
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
                'kind' => $kind,
                'first_name' => $user->first_name ?: ($user->username ?: 'Commercial'),
                'last_name' => $user->last_name ?: '—',
                'email' => $user->email,
                'phone' => $user->phone,
                'commission_type' => $kind === 'commercial'
                    ? Setting::get('default_commission_type', 'percent')
                    : 'none',
                'commission_value' => $kind === 'commercial'
                    ? Setting::get('default_commission_value', 20)
                    : 0,
                'points_balance' => 0,
                'is_active' => $user->is_active,
            ]);
        });
    }

    /**
     * Résout la valeur d'un champ `commercial_id` (ou équivalent) qui peut
     * contenir un identifiant de fiche vendeur OU un identifiant de compte
     * utilisateur (l'utilisateur peut être attribué vendeur depuis n'importe
     * quel compte du staff). La fiche manquante est créée à la volée.
     */
    public function resolve(?string $value, ?string $agencyId = null): ?Commercial
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $fiche = Commercial::query()->find($value);
        if ($fiche) {
            return $fiche;
        }

        $user = User::query()->find($value);
        if (! $user) {
            throw ValidationException::withMessages([
                'commercial_id' => 'Le commercial sélectionné est introuvable.',
            ]);
        }

        return $this->ensureForAny($user, $agencyId);
    }

    /**
     * Règle de validation acceptant un id de fiche vendeur ou un id de compte
     * utilisateur (pour les endpoints qui attribuent un vendeur).
     */
    public static function commercialOrUserRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            if (! is_string($value) || trim($value) === '') {
                return;
            }

            $exists = Commercial::query()->whereKey($value)->exists()
                || User::query()->whereKey($value)->exists();

            if (! $exists) {
                $fail('Le commercial sélectionné est introuvable.');
            }
        };
    }
}
