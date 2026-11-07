<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Espace formateur (« /trainers/me/... ») : réservé aux comptes du personnel
 * rattachés à un profil formateur, quel que soit leur rôle (commercial,
 * community manager… liés via « Compte lié » sur la fiche formateur), ainsi
 * qu'aux comptes de rôle « formateur ». Même règle que `is_trainer` dans
 * UserResource et que le repli de TrainerController::meStats.
 */
class EnsureTrainer
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'Non authentifié.');
        }

        if (($user->currentAccessToken()?->name ?? 'staff-token') === 'client-token') {
            abort(403, 'Cet espace est réservé au personnel.');
        }

        $isTrainer = $user->role?->name === 'formateur'
            || $user->trainerProfile()->exists();

        if (! $isTrainer) {
            abort(403, 'Aucun profil formateur associé à votre compte.');
        }

        return $next($request);
    }
}
