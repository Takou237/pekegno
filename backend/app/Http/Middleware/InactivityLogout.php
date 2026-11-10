<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InactivityLogout
{
    /** Durée d'inactivité par défaut (tous les rôles) : 24 h. */
    public const DEFAULT_LIFETIME_MINUTES = 1440;

    /** Direction générale : jamais moins que les autres rôles (B26). */
    public const DG_LIFETIME_MINUTES = 1440;

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

        // Pas de repli sur SESSION_LIFETIME (120 min dans le .env) : il
        // ramènerait les autres rôles à 2 h.
        return $user->role?->name === 'direction-generale'
            ? self::DG_LIFETIME_MINUTES
            : self::DEFAULT_LIFETIME_MINUTES;
    }
}
