<?php

namespace App\Http\Middleware;

use App\Support\ApiCache;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Met en cache la réponse JSON d'une route GET : `cache.response:<bucket>,<secondes>`.
 *
 * Seules les réponses 200 JSON sont conservées (jamais les exports PDF / Excel,
 * ni les erreurs). L'en-tête `X-Cache: HIT|MISS` permet de vérifier le
 * fonctionnement depuis l'onglet Réseau du navigateur. Le client peut forcer un
 * calcul frais avec l'en-tête `Cache-Control: no-cache`.
 *
 * À placer APRÈS l'authentification et les contrôles de permission (middleware
 * de route) : un utilisateur sans droit est refusé avant d'atteindre le cache.
 */
class CacheApiResponse
{
    public function handle(Request $request, Closure $next, string $bucket = ApiCache::DATA, string $ttl = '300'): Response
    {
        if (! $request->isMethod('GET') || ! config('cache.api_responses', true)) {
            return $next($request);
        }

        $key = ApiCache::responseKey($request, $bucket);
        $bypass = str_contains((string) $request->headers->get('Cache-Control'), 'no-cache');

        if (! $bypass) {
            try {
                $cached = Cache::get($key);
            } catch (Throwable) {
                $cached = null;
            }

            if (is_array($cached) && isset($cached['content'])) {
                return response($cached['content'], 200, [
                    'Content-Type' => $cached['type'] ?? 'application/json',
                    'X-Cache' => 'HIT',
                ]);
            }
        }

        $response = $next($request);

        $type = (string) $response->headers->get('Content-Type');

        if ($response->getStatusCode() === 200 && str_contains($type, 'json')) {
            try {
                Cache::put($key, ['content' => $response->getContent(), 'type' => $type], (int) $ttl);
            } catch (Throwable) {
                // Réponse trop volumineuse pour le cache, base indisponible… : on sert sans cache.
            }
        }

        $response->headers->set('X-Cache', 'MISS');

        return $response;
    }
}
