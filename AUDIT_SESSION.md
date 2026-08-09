# Audit de session — Déploiement et diagnostic PEKEGNO

**Date :** 09 août 2026
**Objet :** Déploiement gratuit (Supabase + Render + Vercel) et diagnostic des problèmes de production (racine 500, lenteur ~10 s/page)

---

## 1. Contexte du projet

- **Backend :** Laravel 13.19.0 / PHP 8.3, API REST, PostgreSQL
- **Frontend :** React 19.2.7 / Vite 6 / Tailwind 4
- **Objectif :** stack 100 % gratuite — Supabase (base de données), Render (Web Service free), Vercel (frontend statique)
- **Repo GitHub :** `Takou237/pekegno` (public, branche `master`)

---

## 2. Infrastructure déployée

| Composant | Service | URL |
|---|---|---|
| Base de données | Supabase `hvpqghxxrzyxchzxegse` (eu-west-2), pooler `aws-0-eu-west-2.pooler.supabase.com:5432` | — |
| Backend | Render Web Service free `pekegno-backend` | https://pekegno-backend.onrender.com |
| Frontend | Vercel `pekegno-frontend` | https://pekegno-frontend.vercel.app |

### Déploiements effectués
- Import du dump local dans Supabase (43 migrations, 29 tables, 12 users, 2 agences, 9 rôles, 53 permissions) — vérifié
- `backend/.env` pointé vers Supabase (pooler :5432, `DB_SSLMODE=require`, mdp avec guillemets)
- Frontend sur Vercel (fix page blanche : retrait de `manualChunks` dans `vite.config.ts` qui crashait React 19)
- Backend sur Render via `render.yaml` (blueprint, `autoDeploy: true`, plan free, secrets en `sync: false`)
- `backend/Dockerfile` : PHP 8.3-cli + pdo_pgsql + zip, CMD = `storage:link && migrate --force && serve`
- Racine `/` en JSON (`routes/web.php`) pour remplacer la welcome view
- 18 erreurs TypeScript corrigées (AdminDashboardPage.tsx, ClientDetailPage.tsx)

### Commits poussés
```
8e60489 chore(deploy): activer autoDeploy explicite sur Render
8b77e04 fix: racine API en JSON + proxy frontend vers backend Render
220f9e3 feat(deploy): Dockerfile prod backend + blueprint Render (Supabase)
b0d45b5 fix(frontend): build TS + page blanche React 19 (manualChunks), config Vercel
```

---

## 3. Diagnostics de la session

### 3.1 Problème n°1 — La racine `/` du backend Render renvoie 500

**Observations :**
- `GET /` → `HTTP 500`, `content-type: text/html` (page d'erreur Laravel), temps de réponse **0,62 s**
- `GET /up` → 200 (hors middleware web)
- API (login, agencies) → 200 (groupe middleware `api`)

**Commandes de diagnostic :**
```bash
curl -s -i https://pekegno-backend.onrender.com/?nocache=$(date +%s)   # HTTP 500 text/html
curl -s https://pekegno-backend.onrender.com/ | grep -c "Let's get started"  # 0 → nouveau code déployé
curl -s https://pekegno-backend.onrender.com/ | grep -c "Server Error"       # 4 → vraie exception
```

**Reproduction locale (conteneur prod) :**
```bash
docker run --rm -d --name pekegno-repro -p 8090:8000 pekegno-backend-prod
curl http://127.0.0.1:8090/      # → 500 reproduit en 0,056s
docker exec pekegno-repro tail -40 storage/logs/laravel.log
```

**Cause racine trouvée (logs conteneur) :**
```
MissingAppKeyException: No application encryption key has been specified.
```
→ `APP_KEY` **absent** dans l'environnement Render. `generateValue: true` dans `render.yaml` ne génère la valeur **qu'à la création initiale** du service ; sur un service déjà existant, la variable n'a jamais été créée.

**Correctif appliqué — `backend/app/Providers/AppServiceProvider.php` :**
```php
public function register(): void
{
    if (empty(config('app.key'))) {
        config(['app.key' => 'base64:'.base64_encode(random_bytes(32))]);
    }
}
```
→ auto-génération d'une clé au boot si absente (ne bloque plus l'application).

---

### 3.2 Problème n°2 — Lenteur : login 6,5 s, pages ~10 s

**Observations :**
- `POST /api/auth/login` → **6,544 s puis 6,545 s** (identique au millième près = délai fixe, pas un cold start)
- Même requête en conteneur local → **0,067 s**
- Requête `psql` directe sur le pooler depuis la machine locale → **1,6 s**
- `dig +short AAAA pooler` → CNAME elb sans vrai AAAA (pas de piège IPv6)

**Cause racine :**
Chaque requête HTTP ouvre une **nouvelle connexion** Render→Supabase (~6,5 s de handshake réseau). Le code et la base sont rapides (0,06 s en local) ; c'est le chemin réseau entre le data center Render et le pooler eu-west-2 qui est lent, avec un coût fixe par connexion.

**Correctif appliqué — `backend/config/database.php` :**
```php
'persistent' => env('DB_PERSISTENT', true),
```
→ connexions pgsql persistantes : la connexion est établie **une seule fois** par process PHP puis réutilisée pour les requêtes suivantes (<1 s).

---

### 3.3 Optimisation complémentaire — OPcache

**Correctif appliqué — `backend/Dockerfile` :**
```dockerfile
RUN docker-php-ext-install pdo_pgsql zip opcache
COPY opcache.ini $PHP_INI_DIR/conf.d/opcache.ini
```

**`backend/opcache.ini` (nouveau fichier) :**
```ini
opcache.enable=1
opcache.enable_cli=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=10000
opcache.validate_timestamps=0
```

---

## 4. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `backend/app/Providers/AppServiceProvider.php` | Fallback APP_KEY au boot (fix 500 racine) |
| `backend/config/database.php` | `'persistent' => env('DB_PERSISTENT', true)` (fix lenteur) |
| `backend/Dockerfile` | Ajout extension opcache + import `opcache.ini` |
| `backend/opcache.ini` | Nouveau — config OPcache prod |

**Rebuild image :** `docker build -t pekegno-backend-prod ./backend` ✅

---

## 5. État git actuel

```
M backend/Dockerfile
M backend/app/Providers/AppServiceProvider.php
M backend/config/database.php
?? backend/opcache.ini
```

---

## 6. Étapes restantes

1. **Valider le conteneur local** avec les fixes (racine 200 + login ~0,1 s)
2. **Committer + pousser** pour déclencher l'auto-deploy Render
3. **Vérifier en prod :** racine JSON + timing login (attendu : ~6,5 s au 1er appel froid, puis <1 s)
4. Optionnel : définir un APP_KEY stable dans le dashboard Render (Edit → Environment) pour des sessions persistantes entre restarts
5. Optionnel : brancher Cloudflare R2 pour les uploads (disque Render éphémère)

---

## 7. Enseignements

- **`generateValue: true` Render** ne régénère pas la valeur sur un service existant → préférer `sync: false` + valeur manuelle, ou un fallback applicatif
- **`php artisan serve`** est mono-process : la persistance de connexion y est très efficace (même process entre requêtes)
- **Toujours reproduire en conteneur prod** pour distinguer un bug applicatif d'un problème d'infrastructure (la 500 et la lenteur ont pu être isolées proprement)
