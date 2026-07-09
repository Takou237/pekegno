<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class InactivityLogout
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($user = Auth::user()) {
            $lastActivity = session('last_activity');

            if ($lastActivity && now()->diffInMinutes($lastActivity) >= config('session.lifetime')) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return response()->json(['message' => 'Session expirée pour inactivité.'], 401);
            }

            session(['last_activity' => now()]);
        }

        return $next($request);
    }
}
