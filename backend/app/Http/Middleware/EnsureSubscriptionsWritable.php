<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * D1 : bloque les écritures sur `subscriptions` une fois la reprise vers les
 * contrats effectuée (config agency.subscriptions_read_only).
 */
class EnsureSubscriptionsWritable
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('agency.subscriptions_read_only')) {
            return response()->json([
                'message' => 'Les abonnements sont en lecture seule : utilisez les packages et contrats Agency.',
            ], 409);
        }

        return $next($request);
    }
}
