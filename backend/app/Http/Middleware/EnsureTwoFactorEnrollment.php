<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lot 9 : bloque les routes métier tant qu'un rôle sensible n'a pas activé
 * sa double authentification. Les routes permettant de l'activer restent
 * accessibles.
 */
class EnsureTwoFactorEnrollment
{
    private const ALLOWED_PATHS = [
        'api/auth/2fa/*',
        'api/auth/logout',
        'api/auth/account',
        'api/auth/change-password',
        'api/user',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('security.enforce_two_factor')) {
            return $next($request);
        }

        $user = $request->user();

        if (
            $user !== null
            && $user->requiresTwoFactor()
            && ! $user->two_factor_enabled
            && ! $request->is(...self::ALLOWED_PATHS)
        ) {
            return response()->json([
                'message' => 'La double authentification doit être activée avant de continuer.',
                'code' => 'TWO_FACTOR_SETUP_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
