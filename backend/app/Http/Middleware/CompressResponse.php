<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Compresse les réponses (JSON/texte) en gzip quand le client l'accepte.
 * Réduit le payload transféré entre Render, le proxy Vercel et le navigateur.
 */
class CompressResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $encoding = $request->headers->get('Accept-Encoding', '');
        if (!str_contains($encoding, 'gzip')) {
            return $response;
        }

        if ($response->headers->has('Content-Encoding')) {
            return $response;
        }

        $content = $response->getContent();
        if ($content === null || strlen($content) < 2048) {
            return $response;
        }

        $contentType = $response->headers->get('Content-Type', '');
        if (!preg_match('~(text|json|javascript|xml)~i', $contentType)) {
            return $response;
        }

        $compressed = gzencode($content, 6);
        if ($compressed === false) {
            return $response;
        }

        $response->setContent($compressed);
        $response->headers->set('Content-Encoding', 'gzip');
        $response->headers->set('Vary', 'Accept-Encoding');
        $response->headers->remove('Content-Length');

        return $response;
    }
}
