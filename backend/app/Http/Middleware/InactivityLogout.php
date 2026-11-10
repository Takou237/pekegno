<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InactivityLogout
{
    /** Durée par défaut (autres rôles) : 2 h. */
    private const DEFAULT_LIFETIME_MINUTES = 120;

    /** Durée de la direction générale : 12 h. */
    private const DG_LIFETIME_MINUTES = 720;

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->last_activity_at) {
            $sessionLifetime = $this->lifetimeMinutes($user);
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

    /**
     * B26 : durée d'inactivité par rôle. Surchargeable via le réglage
     * `session_lifetime_minutes` (nombre, ou tableau `role => minutes`).
     */
    private function lifetimeMinutes(User $user): int
    {
        $setting = Setting::get('session_lifetime_minutes');

        if (is_array($setting)) {
            $role = $user->role?->name;
            $default = $role === 'direction-generale'
                ? self::DG_LIFETIME_MINUTES
                : self::DEFAULT_LIFETIME_MINUTES;

            return (int) ($setting[$role] ?? $setting['default'] ?? $default);
        }

        if (is_numeric($setting)) {
            return (int) $setting;
        }

        return $user->role?->name === 'direction-generale'
            ? self::DG_LIFETIME_MINUTES
            : (int) config('session.lifetime', self::DEFAULT_LIFETIME_MINUTES);
    }
}
