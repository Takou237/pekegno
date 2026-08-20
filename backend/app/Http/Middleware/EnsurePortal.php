<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePortal
{
    /**
     * Vérifie que le token courant appartient au portail demandé
     * (staff = espace employés, client = portail client).
     */
    public function handle(Request $request, Closure $next, string $portal): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'Non authentifié.');
        }

        $tokenName = $user->currentAccessToken()?->name ?? 'staff-token';
        $isClientToken = $tokenName === 'client-token';

        if ($portal === 'client' && ! $isClientToken) {
            abort(403, 'Cet espace est réservé aux clients.');
        }

        if ($portal === 'staff' && $isClientToken) {
            abort(403, 'Cet espace est réservé au personnel.');
        }

        return $next($request);
    }
}