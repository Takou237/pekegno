<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureSingleSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if ($user && $user->active_session_id) {
            $user->tokens()
                ->where('id', '!=', $user->currentAccessToken()?->id)
                ->delete();
        }

        return $next($request);
    }
}
