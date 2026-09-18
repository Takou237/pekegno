# PEKEGNO — Contexte de déploiement o2switch

Ce document donne à n'importe quelle IA (ou humain) tout le contexte nécessaire
pour continuer à déployer des mises à jour de PEKEGNO sur l'hébergement
mutualisé o2switch, sans avoir à redécouvrir les pièges rencontrés.

## 1. Architecture en production

| Composant | URL | Racine web (document root) | SSL |
|---|---|---|---|
| Backend Laravel (API) | `https://pekegnogroup.com` | `/repositories/pekegno/backend/public` | ✅ actif |
| Frontend admin (React) | `http://plateforme.pekegnogroup.com` | `/plateforme.pekegnogroup.com` | ❌ **pas encore activé** |
| Frontend client (`frontend_client/`) | — | **pas encore déployé** | — |

- Compte o2switch : `sc1fopa5058` (chemin home : `/home/sc1fopa5058`).
- Code source cloné sur le serveur via **cPanel → Git Version Control**, dans
  `~/repositories/pekegno` (branche suivie : celle poussée sur GitHub,
  `Takou237/pekegno`). Mettre à jour = faire un `git pull` depuis cette
  interface cPanel (pas de terminal nécessaire pour ça).
- Base de données : **PostgreSQL** (o2switch propose PostgreSQL en plus de
  MySQL — vérifié, section "Bases de données PostgreSQL" du cPanel).
  - Version serveur : **PostgreSQL 9.6** (ancienne — voir piège #1).
  - Base : `sc1fopa5058_pekegno`
  - Utilisateur : `sc1fopa5058_sc1fopa5058`
  - Host/port depuis le PHP du serveur : `127.0.0.1:5432`
  - Mot de passe : dans `backend/.env` sur le serveur (ne pas le redemander à
    l'utilisateur sans raison — ne jamais le faire circuler dans un chat).

## 2. Environnement local (développement)

⚠️ **Ne jamais toucher à la base PostgreSQL locale sans autorisation explicite
de l'utilisateur** — c'est sa base de dev avec potentiellement du travail en
cours.

Le setup local **réel** est décrit dans le `README.md` à la racine du repo
(PAS `frontend/README.md`, qui est un ancien doc d'une phase de dev antérieure
et prête à confusion) :

- **PostgreSQL natif sur l'hôte** (PAS un conteneur Docker), écoute sur
  `127.0.0.1:5432`, base/user/password : `pekegno` / `pekegno` / `pekegno_pass`.
- Backend exécuté via l'image Docker `pekegno-php` avec `--network=host` :
  ```bash
  docker run --rm -v "$PWD":/app -w /app --network=host \
    pekegno-php php artisan <commande>
  ```
- Il existe aussi un `docker-compose.yml` à la racine (services
  postgres+backend+frontend conteneurisés) — **ce n'est PAS le setup utilisé
  au quotidien**, c'est une alternative pour onboarding rapide/CI. Un
  conteneur `pekegno-postgres` lié à ce compose existe mais n'est pas la vraie
  base de dev — ne pas confondre les deux environnements avant d'agir.
- `php artisan migrate:fresh --seed --force` (via la commande Docker
  ci-dessus) reconstruit toute la base de dev avec un jeu de données de
  démo complet (voir `database/seeders/DatabaseSeeder.php` — tous les
  seeders de démo y sont enchaînés : agences, utilisateurs par rôle,
  commerciaux avec/sans compte, factures payées/impayées/partielles,
  dépenses, trésorerie, comptabilité, formations, sessions, inscriptions,
  CRM, contrats, abonnements, certificats...).

## 3. Pièges o2switch rencontrés (à connaître avant d'agir)

### 3.1 PostgreSQL 9.6 = syntaxe SQL limitée
Le `pg_dump`/schéma généré avec un Postgres récent (16) contient des
syntaxes **incompatibles avec PG 9.6** :
- `CREATE SEQUENCE ... AS integer` (typed sequences) → apparu en PG10, à
  supprimer (juste enlever la ligne `AS integer`).
- `SET default_table_access_method = heap;` → apparu en PG12, à supprimer.

`doc/deploy/schema.sql` a déjà été corrigé et **validé en le rejouant sur un
vrai conteneur PostgreSQL 9.6** avant d'être utilisé en prod. Si on
régénère ce fichier un jour (nouveau schéma après migrations), il faudra
refaire cette vérification.

### 3.2 phpPgAdmin : la boîte SQL casse sur tout ce qui n'est pas un SELECT
L'instance phpPgAdmin d'o2switch enveloppe **systématiquement** la requête
tapée dans `SELECT COUNT(*) FROM (...) AS sub` (pour la pagination), ce qui
provoque une erreur de syntaxe dès qu'on colle un `INSERT`/plusieurs
instructions.

**Solution qui marche à tous les coups : l'onglet "Importer"** (upload
direct d'un fichier `.sql`), jamais copier-coller dans la boîte "SQL". Tous
les fichiers `doc/deploy/*.sql` sont prévus pour être importés ainsi.

### 3.3 Droits PostgreSQL : lier un utilisateur à une base ≠ droits sur les objets existants
Après import d'un schéma via phpPgAdmin (connecté avec un rôle admin
interne), les tables/séquences appartiennent à **ce rôle admin**, pas à
l'utilisateur applicatif — même si celui-ci apparaît comme "utilisateur avec
privilèges" sur la base. Résultat : erreurs `SQLSTATE[42501] insufficient
privilege` sur les séquences (ex. `personal_access_tokens_id_seq`) dès que
l'appli essaie d'insérer.

**Fix** : `doc/deploy/fix-permissions.sql` (à importer une fois après tout
import de schéma) — fait un `GRANT ALL ... TO sc1fopa5058_sc1fopa5058` sur
toutes les tables/séquences + `ALTER DEFAULT PRIVILEGES` pour les futures.

### 3.4 OPcache figé (`opcache.validate_timestamps=0`)
Le PHP du serveur ne revérifie jamais si un fichier a changé sur disque tant
que l'OPcache n'est pas vidé. Après tout remplacement de `vendor/` ou
modification de fichier PHP, **si le comportement de l'appli ne change pas
alors que le code/vendor a bien changé, c'est presque toujours l'OPcache**.

**Fix sans terminal — procédure exacte :**
1. Gestionnaire de fichiers → ouvrir `repositories/pekegno/backend/public/`.
2. Uploader `doc/deploy/reset-opcache.php` dans **ce dossier `public/`**
   (pas ailleurs — il doit être accessible depuis le navigateur).
3. Ouvrir `https://pekegnogroup.com/reset-opcache.php` dans le navigateur.
4. Vérifier le message **"OPcache vidé avec succès"**.
5. **Supprimer immédiatement** `reset-opcache.php` du Gestionnaire de
   fichiers (ne jamais le laisser en ligne).

Alternative : dans cPanel → MultiPHP Manager, changer la version PHP du
domaine puis revenir sur 8.3 (force un redémarrage du pool PHP-FPM).

⚠️ Cette étape doit être refaite **à chaque déploiement backend** (nouveau
`git pull`, nouveau `vendor/`...), même pour un seul fichier PHP modifié —
sinon le code déployé peut sembler ignoré alors qu'il est bien sur le
serveur.

### 3.5 "Tiger Protect" (pare-feu applicatif o2switch)
Visible via le header de réponse `tiger-protect-security` et un cookie
`o2s-chl`. Peut intercepter certaines requêtes **POST cross-origin** (par
exemple si le frontend et le backend sont sur des (sous-)domaines
différents) et répondre par une redirection 307 + défi, que le navigateur ne
peut pas résoudre pour un appel AJAX — ce qui ressemble à une erreur CORS
alors que ce n'en est pas une. Observé de façon **intermittente** (a fini
par passer après plusieurs tentatives). Pas de solution garantie de notre
côté : au pire, contacter le support o2switch en mentionnant ce header et
le chemin `/api/*`, ou envisager de servir frontend+backend en same-origin.

### 3.6 `crypto.randomUUID()` exige HTTPS (contexte sécurisé)
Cette API navigateur est **indisponible en `http://`** (non-secure
context). Le frontend l'utilisait dans `ToastContext.tsx` pour générer l'id
de chaque notification. Résultat : tant que `plateforme.pekegnogroup.com`
n'a pas de SSL, **chaque action réussie (création, suppression, login...)
plantait silencieusement juste après l'appel API réussi**, empêchant la
modale de se fermer / la liste de se rafraîchir, et affichant le message
d'erreur générique — alors que l'action avait bel et bien réussi en base.

**Corrigé dans le code** (`ToastContext.tsx` a maintenant un fallback qui ne
dépend pas de `crypto.randomUUID`), mais **activer le SSL sur
`plateforme.pekegnogroup.com` reste fortement recommandé** : d'autres API
navigateur (presse-papier, notifications...) ont la même restriction et
pourraient créer le même genre de bug silencieux plus tard.

### 3.7 Deux (sous-)domaines = deux configurations de document root séparées
`pekegnogroup.com` (domaine racine) et `plateforme.pekegnogroup.com`
(sous-domaine) ont chacun leur propre document root dans cPanel — les
modifier l'un ne touche pas l'autre. Toujours vérifier lequel des deux est
concerné avant de dire "ça devrait marcher".

## 4. Comment déployer une mise à jour

### Backend (Laravel)
1. Le code arrive sur le serveur via **cPanel → Git Version Control** :
   trouver le dépôt `repositories/pekegno`, cliquer sur **Manage**, puis
   **Update from Remote** (le libellé exact peut varier selon la version du
   cPanel — c'est l'équivalent d'un `git pull`). À faire après chaque
   `git push` sur GitHub depuis la machine de dev.
2. Si `composer.json`/`composer.lock` ont changé : reconstruire `vendor/`
   **en local** (le serveur n'a pas accès composer facilement) :
   ```bash
   docker run --rm -v "$(pwd)/backend/composer.json:/build/composer.json" \
     -v "$(pwd)/backend/composer.lock:/build/composer.lock" \
     -v /chemin/vers/vendor-build:/build/vendor -w /build \
     pekegno-php composer install --no-dev --optimize-autoloader --no-interaction
   ```
   Zipper le contenu de `vendor-build/` (pas le dossier lui-même) et
   l'uploader/extraire dans `backend/vendor/` sur le serveur via le
   Gestionnaire de fichiers. **Vérifier que `vendor/autoload.php` existe bien
   à la racine après extraction** (déjà eu un cas de build cassé silencieux
   à cause d'un timeout réseau pendant `composer install`).
3. Si de nouvelles migrations ont été ajoutées : le plus simple est de les
   traduire en `ALTER TABLE`/`CREATE TABLE` SQL à la main et de les importer
   via phpPgAdmin (onglet Importer) — voir piège #3.1 si on régénère un
   schéma complet.
4. **Toujours vider l'OPcache après un déploiement** (piège #3.4).
5. Vérifier `backend/.env` (`APP_URL`, `FRONTEND_URL`, `DB_*`) est toujours
   correct après tout changement de domaine/base.

### Frontend (React)
1. Modifier le code dans `frontend/src/`.
2. Build local avec la bonne URL d'API :
   ```bash
   cd frontend
   VITE_API_URL=https://pekegnogroup.com/api npm run build
   ```
3. Zipper le contenu de `dist/` (pas le dossier), uploader dans
   `/plateforme.pekegnogroup.com` sur le serveur, extraire (en ayant vidé
   l'ancien contenu avant), vérifier qu'il y a bien un `.htaccess` avec la
   règle de fallback SPA (sinon les routes React Router en direct donnent
   du 404) :
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

## 5. Fichiers déjà préparés dans `doc/deploy/`

| Fichier | Usage |
|---|---|
| `schema.sql` | Schéma complet de la BD, validé PG 9.6, à importer une fois sur une base vide |
| `fix-permissions.sql` | Corrige les droits sur tables/séquences après import de schéma (piège #3.3) |
| `seed-admin.sql` | Crée le rôle `super-admin` + le compte `admin@pekegno.com` |
| `seed-admin2.sql` | Un 2ème compte super-admin |
| `seed-roles-permissions.sql` | Les 9 rôles + 162 permissions + leurs associations (généré depuis `PermissionSeeder`/`RoleSeeder`) |
| `env.production.example` | Modèle de `.env` de prod (à copier dans `backend/.env`, mot de passe à compléter) |
| `reset-opcache.php` | Script à visiter une fois puis supprimer (piège #3.4) |
| `setup-storage-link.php` | Équivalent de `php artisan storage:link` sans terminal |
| `vendor-prod.zip` / `frontend-dist.zip` | Derniers builds prêts à uploader (peuvent être obsolètes — régénérer si le code a changé depuis) |

## 6. Préférences de l'utilisateur

- **Éviter le terminal SSH** autant que possible côté o2switch — préférer
  Gestionnaire de fichiers, phpPgAdmin (onglet Importer), et les scripts
  PHP "one-shot" (upload → visite navigateur → suppression) plutôt qu'une
  commande artisan directe sur le serveur.
- **Ne jamais coller de mot de passe réel dans le chat** — même si
  l'utilisateur propose de le faire, le rediriger vers "mets-le directement
  dans le `.env` sur le serveur".
- **Ne jamais modifier la base PostgreSQL locale sans autorisation
  explicite** — c'est arrivé une fois par erreur (mauvais README lu), ça a
  dû être clarifié.
- Toujours **vérifier/tester** (rejouer un schéma sur un vrai conteneur de
  la bonne version PG, `npx tsc -b --noEmit` côté frontend) avant de livrer
  un fichier ou un correctif — plusieurs allers-retours ont eu lieu par le
  passé faute de validation préalable (build composer cassé par un timeout
  réseau non détecté, bugs préexistants dans des seeders jamais exécutés
  auparavant, etc.).
