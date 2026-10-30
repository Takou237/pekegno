# Déploiement + recette — 30/10/2026 (2) (sessions par agence, catalogue réseau, droits clients, validation des ventes des chefs)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 30/10/2026 (`30_10/`)** — appliqué ou non.
Les lots `26_10/` → `30_10/` n'ont **aucun SQL** : s'ils ne sont pas encore
passés, ils sont couverts par celui-ci (le `git pull` ramène leur code, le
`frontend-dist.zip` de `30_10(2)/` remplace les leurs). Faire quand même leur
**recette**. Le lot `22_10/` (SQL) doit être appliqué **avant** celui-ci.

## 1. Ce qui change

Code : commit `a37ffee` (lot `30_10/`, déjà sur GitHub `master`) + les
modifications locales de ce lot — **à commiter et pousser sur `master` avant le
déploiement** (§3, étape 0).

| # | Changement | Partie |
|---|---|---|
| 1 | **Sessions de formation par agence** : une session créée dans une agence reste dans cette agence (fin de la synchronisation entre agences / pays, même pour une formation déployée partout). Case « Synchroniser entre agences » retirée. Corrige : session en double dans l'agence d'origine, session copiée rattachée à la formation d'un autre pays, session placée dans une autre agence que celle de sa formation | Backend + Frontend + Base |
| 2 | **Suppression des sessions** : le chef de département peut supprimer une session (comme le chef d'agence). Boutons Modifier / Supprimer des sessions affichés selon les droits réels du rôle | Backend + Frontend + Base |
| 3 | **Pages Produits à tous les niveaux** (catalogue, pays, agence, département) : produits, formations, packages et prestations de **toutes les agences de tous les pays**, agence (+ ville) indiquée sur chaque élément, **filtre par agence pour tous les rôles** (« Agence — Pays »). L'agence de la page reste l'agence par défaut des ventes / inscriptions / créations | Backend + Frontend |
| 4 | **« Nouvelle inscription » depuis une formation** : agence et formation affichées en texte fixe (sans liste déroulante) ; l'agence est celle de la formation | Frontend |
| 5 | **Table Clients** : boutons d'action pour tous les rôles selon leurs droits ; commercial, caissier, comptable et community-manager peuvent **modifier et supprimer** un client | Frontend + Base |
| 6 | **Responsive Profil / Paramètres** : le menu ☰ garde le menu du pays / de l'agence / du département **même après actualisation** de la page | Frontend |
| 7 | **Ventes des chefs d'agence / de département** (souscription package, inscription formation) : preuve de paiement **obligatoire**, facture **en attente de validation**, avance encaissée seulement à l'acceptation de la preuve par le caissier / la direction. Email « facture en attente » aux caissiers désormais envoyé aussi pour les **packages** | Backend + Frontend |

| Partie | Action |
|---|---|
| Base de données | **3 migrations** → `migration-2026-10-30.sql` (suppression de `training_sessions_synced` + droits) |
| Permissions | **aucune nouvelle** (droits existants attribués à d'autres rôles) |
| Routes | **aucune nouvelle** (vider quand même les caches) |
| `vendor/` | **aucun changement** (`composer.json` / `composer.lock` inchangés) |
| `.env` | rien |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-10-30.sql` | Les **3 migrations** du 30/10 : `DROP TABLE training_sessions_synced`, `clients.modifier` + `clients.supprimer` → commercial / caissier / comptable / community-manager, `sessions.supprimer` → responsable-departement, + lignes `migrations` | Importer **après** le `git pull` |
| `frontend-dist.zip` | Build admin du 30/10 (2) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `migration-2026-10-30.sql` importé **2 fois de suite** sur un vrai **PostgreSQL 9.6**
  (`schema.sql` → rôles/permissions → lots 13/10 et 22/10) : zéro erreur,
  `INSERT 0 0` et `NOTICE … does not exist, skipping` au rejeu ; droits obtenus conformes ;
- `tsc -b` + build OK, `php -l` OK sur les fichiers PHP modifiés ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : nouveaux tests OK
  (`TrainingSessionAgencyTest` ×5, ventes des chefs en validation ×2) ;
  **aucun nouvel échec** — les échecs restants sont connus (cf. `CLAUDE.md`) :
  extension GD absente de l'image de test, 5 tests en retard sur la preuve
  obligatoire du chef d'agence, `ClientPackageSubscriptionTest` (avance plafonnée).

## 3. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0
   (postérieur à `a37ffee`).
3. **Base** : phpPgAdmin → base → onglet **Importer** → `30_10(2)/migration-2026-10-30.sql`.
   Attendu : `DROP TABLE`, `INSERT 0 8`, `INSERT 0 1`, `INSERT 0 3`, `COMMIT`
   (au rejeu : `NOTICE … does not exist, skipping` et `INSERT 0 0`).
   ⚠️ À faire **après** l'étape 2 : l'ancien code lit encore `training_sessions_synced`.
4. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : contrôleurs PHP modifiés, service supprimé) :
   uploader `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
5. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `30_10(2)/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
6. Navigateur : **Ctrl+Maj+R** (les utilisateurs déjà connectés rechargent la page
   pour récupérer leurs nouveaux droits), puis recette.

Contrôles (boîte SQL → `SELECT` uniquement) :
```sql
SELECT migration FROM migrations WHERE migration LIKE '2026_10_30%' ORDER BY migration;  -- 3 lignes
SELECT to_regclass('public.training_sessions_synced');  -- NULL
SELECT p.name, string_agg(r.name, ', ' ORDER BY r.name) FROM role_permission rp
  JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
  WHERE p.name IN ('clients.modifier', 'clients.supprimer', 'sessions.supprimer') GROUP BY 1 ORDER BY 1;
  -- clients.* : caissier, commercial, community-manager, comptable, direction-generale,
  --             responsable-agence, responsable-departement, super-admin
  -- sessions.supprimer : direction-generale, responsable-agence, responsable-departement, super-admin
```

Diagnostic :
- Erreur SQL « relation training_sessions_synced does not exist » côté appli →
  backend pas à jour ou **OPcache non vidé** (étapes 2 et 4).
- Une session se crée encore dans plusieurs agences / la case « Synchroniser » est
  encore visible → frontend non extrait ou cache navigateur (étape 5–6).
- Bouton Supprimer / Modifier client absent pour un caissier → SQL non importé
  (étape 3) ou l'utilisateur n'a pas rechargé la page.
- Vente d'un chef encore validée directement → OPcache non vidé.

Retour arrière : repointer le dépôt sur `a37ffee` (lot `30_10/`), vider caches +
OPcache, réuploader `30_10/frontend-dist.zip`, puis recréer la table
`training_sessions_synced` (section A de `22_10/migration-2026-10-22.sql`,
rejouable). Les droits accordés peuvent rester (sans effet sur l'ancien code).

## 4. Recette

- [ ] **Sessions par agence** : formation déployée dans plusieurs pays → créer une session dans l'agence A → elle n'apparaît **que** dans l'agence A (une seule session, pas de doublon) ; aucune case « Synchroniser entre agences » dans le formulaire.
- [ ] **Modifier une session** dans l'agence A → les sessions des autres agences ne changent pas.
- [ ] **Chef de département** → Sessions → Supprimer une session → OK (plus de 403).
- [ ] **Formateur** → Sessions : pas de bouton Supprimer.
- [ ] **Pages Produits** (`/catalog/services`, `/countries/:id/services`, `/countries/:id/agencies/:id/services`, `/departments/:id/products`) : onglets Produits, Formations, Packages, Prestations → éléments de **toutes les agences / tous les pays**, agence indiquée sur chaque élément ; filtre « Agence » présent et fonctionnel, y compris connecté en caissier / commercial.
- [ ] **Nouvelle inscription** depuis la carte d'une formation d'une autre agence → Agence et Formation affichées en texte fixe (sans chevron), agence = celle de la formation ; inscription créée.
- [ ] **Clients** connecté en caissier / commercial / comptable → boutons Voir, Modifier, Supprimer présents et fonctionnels.
- [ ] **Téléphone** : depuis un pays (ou une agence) → Profil → **actualiser** → le menu ☰ reste celui du pays (de l'agence).
- [ ] **Chef d'agence** → souscrire un package **sans preuve** → refus « preuve obligatoire » ; **avec preuve** → facture « en attente de validation », montant payé 0, email reçu par le caissier ; le caissier accepte la preuve → avance encaissée.
- [ ] **Chef de département** → nouvelle inscription formation avec preuve → facture « en attente de validation » visible dans « Validation » du caissier.
- [ ] **Recette du lot `30_10/`** s'il n'était pas encore passé.
