<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InactivityLogout
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->last_activity_at) {
            $sessionLifetime = config('session.lifetime', 120);
            $inactiveMinutes = now()->diffInMinutes($user->last_activity_at, true);

            if ($inactiveMinutes >= $sessionLifetime) {
                $user->currentAccessToken()?->delete();

                return response()->json([
                    'message' => 'Session expirée pour inactivité.',
                ], 401);
            }
        }

        return $next($request);
    }
}
