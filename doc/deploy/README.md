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

### État de la production (à tenir à jour après chaque déploiement)

✅ **Déjà appliqué en prod au 30/09/2026 — NE PAS réimporter / relancer :**

| Script | Contenu |
|---|---|
| `migration-2026-09-28.sql` | remise inscription, taux de change pays, monnaie groupe, commission caissière |
| `migration-2026-09-29.sql` | modèle de facture par pays, permission caissière, types de formation |
| `migration-2026-09-30.sql` | `invoice_payments.receipt_number` (reçus de versement) |
| `migration-2026-09-30-2fa.sql` | `users.two_factor_channel` (2FA par email) |
| `migration-2026-09-30-payer-phone.sql` | `invoices.payer_phone` (téléphone du payeur mobile money) |
| `repair-enrollment-payments.php` | paiements manquants des inscriptions créés (`?apply=1` fait, fichier supprimé du serveur) |

⏳ **À appliquer avec le déploiement du 01/10/2026** (voir
`DEPLOIEMENT-2026-10-01.md`) — déplacer dans le tableau ci-dessus une fois fait :

| Script | Contenu |
|---|---|
| `repair-converted-clients-2026-10-01.sql` | rattache à leur agence / commercial les clients issus d'une conversion de prospect (idempotent, aucune migration de schéma) |

Dernière migration Laravel présente en prod :
`2026_09_30_000003_add_payer_phone_to_invoices_table`. Pour un prochain
déploiement, n'importer que les **nouveaux** scripts SQL correspondant aux
migrations ajoutées après celle-ci (contrôle :
`SELECT migration FROM migrations ORDER BY id DESC LIMIT 5;`).

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

### 3.8 Emails : sans SMTP configuré, aucun email ne part
Création d'utilisateur (identifiants), réinitialisation par l'admin, « mot
de passe oublié » et désormais les codes 2FA par email envoient des messages.
Avec `MAIL_MAILER=log` (valeur par défaut de `.env.example`), les messages
sont seulement écrits dans `storage/logs/laravel.log` : l'utilisateur ne
reçoit rien.

⚠️ **Piège identifié le 30/09 (diagnostic réel)** : le certificat TLS du
serveur mail d'o2switch ne couvre PAS `mail.pekegnogroup.com` (vérifié :
« hostname mismatch »). Avec `MAIL_HOST=mail.pekegnogroup.com` + `smtps`,
la connexion échoue sur la vérification du nom d'hôte (code 62) : les
emails ne partent pas, sans erreur visible côté utilisateur.

✅ **Hostnames valides** (certificat vérifié, code 0) — dans l'ordre de
préférence :
1. `pekegnogroup.com:465` — c'est le serveur sortant que cPanel affiche
   lui-même dans « Connect Devices » (Secure SSL/TLS Settings) ;
2. `mail.lynx.o2switch.net:465` — hostname interne du serveur (Lynx).

❌ **Interdit** : `mail.pekegnogroup.com` (certificat non couvert).

En production, créer une boîte mail dans cPanel (ex.
`noreply@pekegnogroup.com`) puis renseigner dans `backend/.env` :
```
MAIL_MAILER=smtp
MAIL_SCHEME=smtps
MAIL_HOST=pekegnogroup.com   # serveur sortant SSL affiché par cPanel ; alternative : mail.lynx.o2switch.net
MAIL_PORT=465
MAIL_USERNAME=noreply@pekegnogroup.com
MAIL_PASSWORD="mot de passe de la boîte"   # À SAISIR SUR PLACE, jamais dans un chat
MAIL_FROM_ADDRESS="noreply@pekegnogroup.com"
MAIL_FROM_NAME="PEKEGNO"
FRONTEND_URL=https://plateforme.pekegnogroup.com
```
Puis vider l'OPcache (#3.4). En cas d'échec SMTP, « mot de passe oublié »
répond désormais 503 avec un message clair et l'erreur est journalisée,
et le renvoi d'un code 2FA échoue proprement (503) sans casser le flux.

Vérifier aussi cPanel → **Email Deliverability** : activer SPF et DKIM
pour `pekegnogroup.com`, sinon les emails finissent en spam chez Gmail.

#### Procédure cPanel pas à pas (option A — 10 minutes)
1. **cPanel → Email Deliverability** : si « Issues Found » pour
   `pekegnogroup.com`, cliquer **Repair** (installe SPF + DKIM). Étape
   optionnelle mais fortement recommandée pour la délivrabilité.
2. **cPanel → Email Accounts → Create** :
   - Domain : `pekegnogroup.com`, Username : `noreply`
   - Password : générer un mot de passe fort (⚠️ ne jamais le coller dans
     un chat — le saisir directement dans le `.env` à l'étape 4)
   - Storage : décocher ou mettre 1 Go (boîte d'envoi technique, pas de
     réception utile) ; décocher « Send welcome email »
3. **cPanel → Email Accounts → Connect Devices** (sur la boîte `noreply`) :
   noter le serveur **SMTP** de la section « Secure SSL/TLS Settings » —
   attendu `pekegnogroup.com`, port **465** (si cPanel affiche autre chose,
   utiliser ce qu'il affiche, en vérifiant le certificat : jamais
   `mail.pekegnogroup.com`).
4. **Gestionnaire de fichiers → `repositories/pekegno/backend/.env`** :
   éditer le bloc `MAIL_*` exactement comme ci-dessus (mot de passe saisi
   sur place). Si un fichier `bootstrap/cache/config.php` existe, le
   **supprimer** : sinon le `.env` est ignoré (diagnostic `mail-test.php`
   l'affiche en tête).
5. **Vider l'OPcache** (piège #3.4) : uploader `reset-opcache.php` dans
   `backend/public/`, ouvrir `https://pekegnogroup.com/reset-opcache.php`,
   vérifier le message de succès, **supprimer le fichier**.
6. **Tester** : uploader `mail-test.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/mail-test.php`. Attendu : « Config en cache :
   non », `MAIL_MAILER: smtp`, hôte `pekegnogroup.com:465`, toutes
   les connexions réseau « OK » et l'email de test reçu (vérifier les
   spams). **Supprimer immédiatement le fichier.**
7. **Recette applicative** : dans la plateforme, utiliser « Mot de passe
   oublié » avec une vraie adresse (email reçu, lien fonctionnel), créer
   un utilisateur test (email de bienvenue reçu), activer la 2FA par
   email sur un compte (code reçu à la connexion suivante).

Si l'étape 6 échoue malgré tout (connexion `pekegnogroup.com:465` en ÉCHEC
depuis le serveur lui-même), essayer `MAIL_HOST=mail.lynx.o2switch.net` ;
si les deux échouent, ouvrir un ticket au support o2switch en citant le
hostname et le port — c'est le seul cas restant où le blocage sortant
serait réel.

🔐 **Mot de passe compromis** : si le mot de passe de la boîte a circulé
par écrit (chat, capture d'écran…), le changer aussitôt (cPanel → Email
Accounts → Manage → Change Password) et le ressaisir dans le `.env`.

### 3.9 « The route api/... could not be found » alors que le code est à jour
Vu le 30/09 : `git pull` « Déjà à jour » sur `master`, la route présente dans
`backend/routes/api.php`, mais la prod répond 404 « route could not be
found » (ex. `api/users/{id}/reset-password`, `api/auth/2fa/email/send`).
Cause : le PHP web sert une ancienne table de routes (cache Laravel
`bootstrap/cache/routes-v7.php` et/ou OPcache).

**Fix (SSH, depuis `~/repositories/pekegno/backend`) :**
```bash
php artisan route:clear
php artisan config:clear
ls -la bootstrap/cache/        # ne doit rester que packages.php, services.php
php artisan route:list --path=<chemin>   # contrôle
```
Puis **vider l'OPcache via le navigateur** (#3.4) : `artisan` en SSH ne vide
pas l'OPcache du site web. Ne jamais lancer `php artisan route:cache` /
`config:cache` / `optimize` en prod : ça refige les routes et le `.env`.

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
4. **Toujours vider les caches après un déploiement** : `php artisan route:clear`
   + `php artisan config:clear` en SSH (piège #3.9), puis l'OPcache via
   `reset-opcache.php` (piège #3.4).
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
   `/plateforme.pekegnogroup.com` sur le serveur, extraire en écrasant (inutile
   de vider l'ancien contenu : garder les anciens fichiers de `assets/` permet
   aux onglets déjà ouverts de continuer à charger leurs pages ; `index.html`
   n'est jamais mis en cache, cf. `.htaccess`), vérifier qu'il y a bien un `.htaccess` (désormais
   fourni par `frontend/public/.htaccess`, donc copié automatiquement dans `dist/`) avec la
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
| `env.production.example` | Modèle de `.env` de prod (à copier dans `backend/.env`, mot de passe à compléter) — **volontairement non versionné** (ignoré par git, cf. `.gitignore`) : en créer une copie localement si besoin |
| `DEPLOIEMENT-2026-09-28.md` | Procédure pas à pas + checklist de recette de la mise à jour du 28/09 |
| `migration-2026-09-29.sql` | ✅ **Appliqué en prod.** Corrections du 29/09 (modèle de facture par pays, permission caissière, types de formation) |
| `migration-2026-09-30.sql` | ✅ **Appliqué en prod.** Reçu imprimable par versement (colonne `invoice_payments.receipt_number` + numérotation des versements existants) |
| `migration-2026-09-30-2fa.sql` | ✅ **Appliqué en prod.** Colonne `users.two_factor_channel` (2FA par email) |
| `migration-2026-09-30-payer-phone.sql` | ✅ **Appliqué en prod.** Colonne `invoices.payer_phone` (téléphone du payeur mobile money) |
| `DEPLOIEMENT-2026-10-01.md` | Procédure + recette du 01/10 (services seuls dans « Nouvelle vente », email aux caissiers, conversion prospect, erreurs de chargement de page) |
| `repair-converted-clients-2026-10-01.sql` | ⏳ **À importer une fois** (01/10). Rattache à leur agence / commercial les clients issus d'une conversion de prospect — idempotent |
| `repair-enrollment-payments.php` | ✅ **Déjà exécuté en prod (ne pas relancer).** One-shot : crée les paiements manquants des inscriptions |
| `mail-test.php` | One-shot : diagnostic SMTP (config chargée, connexions sortantes, envoi test), puis supprimer |
| `migration-2026-09-28.sql` | ✅ **Appliqué en prod.** Mise à jour de la BD pour les tickets du 28/09 (remise inscription, taux de change pays, monnaie groupe, commission caissier) |
| `reset-transactions.sql` | Remet à zéro toutes les transactions (factures, paiements, dépenses, compta, trésorerie, commissions, points, inscriptions, abonnements) en conservant la configuration — **sauvegarde obligatoire avant** |
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
