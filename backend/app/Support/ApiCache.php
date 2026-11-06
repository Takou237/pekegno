<?php

namespace App\Support;

use Illuminate\Cache\DatabaseStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Cache des réponses JSON de l'API, invalidé par numéro de version.
 *
 * Chaque « bucket » a une version stockée dans le cache. La clé d'une réponse
 * contient cette version : incrémenter la version rend d'un coup toutes les
 * réponses du bucket obsolètes (sans avoir à les lister ni à les supprimer).
 *
 * - data      : tableaux de bord, statistiques, rapports, catalogue public.
 *               Version incrémentée par TOUTE écriture réussie de l'API
 *               (facture, paiement, inscription, présence…), y compris les
 *               mises à jour en masse qui ne déclenchent pas d'événement modèle.
 * - reference : listes de référence (catégories, rôles, permissions, villes,
 *               pays / agences du catalogue public…). Version incrémentée par
 *               les écritures sur ces ressources uniquement.
 *
 * Les tâches planifiées (console) ne passent pas par l'API : le TTL court du
 * bucket data borne alors la durée pendant laquelle un chiffre peut être ancien.
 */
final class ApiCache
{
    public const DATA = 'data';

    public const REFERENCE = 'reference';

    /** Préfixes d'URL (après /api/) dont l'écriture invalide aussi les listes de référence. */
    public const REFERENCE_PATHS = [
        'categories', 'course-categories', 'roles', 'permissions', 'users',
        'cities', 'countries', 'agencies', 'departments', 'client-team-roles',
        'services', 'products', 'courses', 'packages', 'prestation-offers', 'settings',
    ];

    /**
     * Écritures sans effet sur les données métier (connexion, déconnexion, 2FA,
     * panier du site client, mot de passe) : elles n'invalident rien.
     */
    public const NEUTRAL_PATHS = [
        'api/auth/login', 'api/auth/logout', 'api/auth/2fa/*', 'api/auth/forgot-password',
        'api/auth/reset-password', 'api/auth/change-password', 'api/staff/login',
        'api/client/login', 'api/client/logout', 'api/client/cart*',
    ];

    public static function version(string $bucket): int
    {
        try {
            return (int) Cache::get(self::versionKey($bucket), 1);
        } catch (Throwable) {
            return 1;
        }
    }

    public static function bump(string $bucket): void
    {
        try {
            $key = self::versionKey($bucket);
            Cache::add($key, 1);
            Cache::increment($key);
        } catch (Throwable) {
            // Le cache ne doit jamais faire échouer une écriture métier.
        }
    }

    /**
     * Clé d'une réponse : bucket + version + utilisateur (les réponses dépendent
     * du rôle et du périmètre de l'appelant) + URL avec paramètres triés.
     */
    public static function responseKey(Request $request, string $bucket): string
    {
        $query = $request->query();
        ksort($query);

        $identity = $request->user()?->getAuthIdentifier() ?? 'guest';
        $signature = $request->path().'?'.http_build_query($query);

        return sprintf('apicache:%s:v%d:%s:%s', $bucket, self::version($bucket), $identity, md5($signature));
    }

    /**
     * Le cache « database » ne supprime jamais les entrées expirées : les
     * réponses des anciennes versions s'accumuleraient dans la table. On purge
     * donc de temps en temps (1 écriture sur 50) les entrées expirées.
     */
    public static function pruneExpired(): void
    {
        try {
            $store = Cache::getStore();

            if (! $store instanceof DatabaseStore || random_int(1, 50) !== 1) {
                return;
            }

            DB::table(config('cache.stores.database.table', 'cache'))
                ->where('key', 'like', '%apicache:%')
                ->where('expiration', '<', now()->getTimestamp())
                ->delete();
        } catch (Throwable) {
            // Purge opportuniste : sans conséquence si elle échoue.
        }
    }

    private static function versionKey(string $bucket): string
    {
        return "apicache:version:{$bucket}";
    }
}
