# Bascule de l'API : `pekegnogroup.com` → `api.plateforme.pekegnogroup.com`

Demande de l'hébergement : le domaine principal `pekegnogroup.com` est **réservé au site
principal (vitrine)**. Aujourd'hui il sert l'API Laravel (racine
`/repositories/pekegno/backend/public`). L'API doit passer sur le sous-domaine
**`api.plateforme.pekegnogroup.com`**.

| | Avant | Après |
|---|---|---|
| Plateforme (React) | `https://plateforme.pekegnogroup.com` | **inchangé** |
| API (Laravel) | `https://pekegnogroup.com/api` | `https://api.plateforme.pekegnogroup.com/api` |
| `pekegnogroup.com` | API | **site principal** (libéré à la toute fin) |

Rien ne change dans le code : seuls la config cPanel, le `.env` du backend, les URL de fichiers
déjà enregistrées en base et le build du frontend.

Pré-requis : le lot `03_11(3)` (ou le dernier lot) est déployé et fonctionne.
Le `frontend-dist.zip` de ce dossier contient **le même code que `03_11(3)`**, seule l'URL
de l'API change.

## Contenu du dossier

| Fichier | Usage |
|---|---|
| `migration-api-subdomain.sql` | Remplace `https://pekegnogroup.com/storage/…` par `https://api.plateforme.pekegnogroup.com/storage/…` dans toutes les colonnes texte/JSON (images formations/services, cachet pays, preuves…). Rejouable, une transaction. Validé sur PostgreSQL 9.6 (2ᵉ passage = 0 modification) |
| `frontend-dist.zip` | Build admin avec `VITE_API_URL=https://api.plateforme.pekegnogroup.com/api` (`.htaccess` inclus) |

## Étapes (dans cet ordre — la plateforme reste en ligne jusqu'à l'étape 5)

### 1. Créer le sous-domaine `api.plateforme.pekegnogroup.com` (cPanel)
cPanel → **Domaines** → **Créer un nouveau domaine** :
- Sous-domaine : `api` sur le domaine `plateforme.pekegnogroup.com` (existe déjà)
- **Décocher** « Partager la racine du document avec pekegnogroup.com »
- Racine du document : **`/repositories/pekegno/backend/public`** (la même que l'actuelle)

Les deux domaines pointent alors sur le même backend : rien ne casse.

### 2. Activer le SSL
cPanel → **SSL/TLS Status** → cocher `api.plateforme.pekegnogroup.com` → **Run AutoSSL**.
Attendre le cadenas vert (quelques minutes).

Test : ouvrir `https://api.plateforme.pekegnogroup.com/api/` dans le navigateur → une réponse Laravel
(JSON / 404 Laravel), **pas** une page d'erreur o2switch ni un avertissement de certificat.
Ouvrir aussi l'URL d'une image existante en remplaçant `pekegnogroup.com` par
`api.plateforme.pekegnogroup.com` → l'image s'affiche (le lien `public/storage` est déjà en place).

### 3. Modifier le `.env` du backend
Gestionnaire de fichiers → `repositories/pekegno/backend/.env` → changer **une seule ligne** :
```
APP_URL=https://api.plateforme.pekegnogroup.com
```
Ne rien changer d'autre : `FRONTEND_URL=https://plateforme.pekegnogroup.com` reste tel quel
(c'est lui qui autorise la plateforme à appeler l'API — CORS). Le bloc `MAIL_*` n'est pas concerné.

Puis vider les caches (SSH depuis `~/repositories/pekegno/backend`) :
`php artisan config:clear && php artisan route:clear`
et **vider l'OPcache** (`reset-opcache.php` dans `backend/public/`, ouvrir
`https://api.plateforme.pekegnogroup.com/reset-opcache.php`, **supprimer le fichier**).

### 4. Basculer les URL de fichiers en base
**Sauvegarde de la base d'abord** (phpPgAdmin → Exporter).
phpPgAdmin → base `sc1fopa5058_pekegno` → onglet **Importer** → `migration-api-subdomain.sql`.
Contrôle (boîte SQL) :
`SELECT id, cover_image FROM services WHERE cover_image LIKE 'https://pekegnogroup.com/storage/%';` → 0 ligne.

### 5. Déployer le frontend qui appelle la nouvelle API
Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` → uploader
`api-subdomain/frontend-dist.zip` → **Extraire** en écrasant. Vérifier `.htaccess`.
Navigateur : **Ctrl+Maj+R** sur `https://plateforme.pekegnogroup.com/login`.

### 6. Recette (avant de libérer le domaine principal)
- [ ] Connexion OK ; F12 → onglet Réseau : les appels partent vers `https://api.plateforme.pekegnogroup.com/api/...`.
- [ ] Une création (client, facture…) réussit — pas d'erreur CORS.
- [ ] Images des formations / services et cachet de facture s'affichent.
- [ ] Upload d'une preuve de paiement puis ouverture du fichier : l'URL commence par
      `https://api.plateforme.pekegnogroup.com/storage/`.
- [ ] « Mot de passe oublié » : l'email arrive et le lien ouvre bien `plateforme.pekegnogroup.com`.

### 7. Libérer `pekegnogroup.com` pour le site principal
Seulement quand l'étape 6 est validée : cPanel → **Domaines** → `pekegnogroup.com` →
**Gérer** → changer la racine du document de `/repositories/pekegno/backend/public` vers le
dossier du site principal (ex. `/public_html`). Dire à la personne qui gère le site principal
qu'elle peut l'y déposer.

## Diagnostic
- Erreur certificat sur `api.plateforme.pekegnogroup.com` → AutoSSL pas encore passé (étape 2).
- La plateforme affiche « Erreur réseau » / CORS → `FRONTEND_URL` modifié par erreur, ou
  OPcache/config non vidés (étape 3) ; ou piège « Tiger Protect » (README §3.5) : réessayer.
- Les nouvelles images uploadées ont encore une URL `https://pekegnogroup.com/storage/…` →
  `APP_URL` pas pris en compte : `config:clear` + OPcache (étape 3).
- Anciennes images cassées après l'étape 7 → SQL de l'étape 4 non importé.

## Retour arrière
Avant l'étape 7 : réuploader `03_11(3)/frontend-dist.zip` (API sur `pekegnogroup.com`),
remettre `APP_URL=https://pekegnogroup.com`, vider caches + OPcache. Les URL basculées en base
restent valides tant que `api.plateforme.pekegnogroup.com` existe.
