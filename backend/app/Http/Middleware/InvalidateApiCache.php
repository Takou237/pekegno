<?php

namespace App\Http\Middleware;

use App\Support\ApiCache;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Toute écriture réussie de l'API (POST / PUT / PATCH / DELETE en 2xx/3xx)
 * invalide le cache des statistiques ; une écriture sur une liste de référence
 * invalide aussi ces listes. Voir App\Support\ApiCache.
 */
class InvalidateApiCache
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (
            $request->is('api/*')
            && ! $request->isMethodSafe()
            && $response->getStatusCode() < 400
            && ! $request->is(...ApiCache::NEUTRAL_PATHS)
        ) {
            ApiCache::bump(ApiCache::DATA);

            $resource = explode('/', substr($request->path(), strlen('api/')))[0] ?? '';

            if (in_array($resource, ApiCache::REFERENCE_PATHS, true)) {
                ApiCache::bump(ApiCache::REFERENCE);
            }

            ApiCache::pruneExpired();
        }

        return $response;
    }
}
