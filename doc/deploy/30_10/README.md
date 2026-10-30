# Déploiement + recette — 30/10/2026 (souscription inter-agences, champ Vendeur, menus responsive)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 29/10/2026 (2) (`29_10(2)/`)** — appliqué ou non.
Les lots `29_10/` et `29_10(2)/` n'ont **aucun SQL** : s'ils ne sont pas encore
passés, ils sont couverts par celui-ci (le `git pull` ramène leur code, le
`frontend-dist.zip` de `30_10/` remplace les leurs). Faire quand même leur
**recette**, et **vider le cache de routes** (route ajoutée le 29/10 (2)).

## 1. Ce qui change

Code : commit `ccb5991` (déjà sur GitHub `master`) + les modifications locales
de ce lot — **à commiter et pousser sur `master` avant le déploiement** (§2,
étape 0).

| # | Changement | Partie |
|---|---|---|
| 1 | **Souscription d'un package inter-agences** : plus d'erreur « Agence hors de votre périmètre » en souscrivant le package d'une autre agence (aligné sur les prestations et les factures) ; le CA reste à l'agence du package | Backend |
| 2 | **Bouton « Souscrire un client »** sur les packages de la page Produits d'une agence (`…/agencies/:agencyId/services`), comme sur la page Produits du pays | Frontend |
| 3 | **Champ « Vendeur »** (au lieu de « Commercial ») dans « Souscrire un client » (package) et « Nouvelle souscription » (prestation) : liste de tous les utilisateurs **sauf super-admin** (paramètre API `exclude_role` sur `GET /users`) | Backend + Frontend |
| 4 | **« Nouvelle inscription » (formation)** : le vendeur devient la même liste (tous les utilisateurs sauf super-admin) ; un commercial / caissier / chef d'agence est présélectionné mais peut choisir un autre vendeur. Les formateurs **sans compte utilisateur** ne sont plus proposés | Frontend |
| 5 | **Responsive pays** : comme l'agence et le département, le menu ☰ n'affiche que le menu du pays (plus de doublon avec le menu principal) et la liste des sous-menus sous la carte pays est masquée sur mobile/tablette | Frontend |
| 6 | **Responsive Profil / Paramètres** : ouverts depuis un pays / une agence / un département, le menu ☰ garde le menu de cet espace (il ne bascule plus sur le menu principal) ; lien « Mon profil » (ou « Paramètres » pour un commercial) en bas du tiroir des espaces | Frontend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration** (`backend/database` inchangé) |
| Permissions | **aucune nouvelle** |
| Routes | aucune nouvelle dans ce lot (vider quand même le cache : routes du 29/10 (2), et `php artisan route:clear` est sans risque) |
| `vendor/` | **aucun changement** (`composer.json` / `composer.lock` inchangés) |
| `.env` | rien |
| Frontend admin | `30_10/frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

Validé avant livraison : `tsc -b` + build OK. Suite backend complète (image
Docker PHP 8.3, SQLite mémoire) : nouveau test
`CashierAgencyActionsTest::test_caissier_subscribes_package_of_another_agency`
OK ; les échecs restants ne viennent pas de ce lot :
- ~20 tests en erreur « GD extension is not installed » (extension absente de
  l'image Docker de test, pas du code) ;
- les 6 KO **déjà présents avant ce lot** (`ManagerSalesTest` ×2,
  `Phase3ValidationWorkflowTest`, `Phase5BilanTest` ×2,
  `ClientPackageSubscriptionTest`) — revérifiés sans les modifications : mêmes échecs.

## 2. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0
   (il doit être postérieur à `ccb5991`).
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : 2 contrôleurs PHP modifiés) : uploader
   `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `30_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
5. Navigateur : **Ctrl+Maj+R**, puis recette.

Aucun SQL à importer. Contrôle facultatif (boîte SQL, `SELECT` uniquement) —
la dernière migration doit rester celle du 22/10 :
```sql
SELECT migration FROM migrations ORDER BY id DESC LIMIT 5;
```

Diagnostic :
- « Agence hors de votre périmètre » toujours affiché à la souscription d'un
  package → backend pas à jour ou **OPcache non vidé** (étape 3).
- Le super-admin apparaît encore dans la liste « Vendeur » → même cause
  (`GET /users?exclude_role=super-admin` ignoré par l'ancien code).

Retour arrière : repointer le dépôt sur `ccb5991` (lot `29_10(2)/`), vider caches +
OPcache, réuploader `29_10(2)/frontend-dist.zip`. Aucune donnée à restaurer
(pas de SQL ; les souscriptions inter-agences déjà créées restent valides).

## 3. Recette

- [ ] **Souscription inter-agences** : caissier (ou commercial) de l'agence A → page Produits → onglet Packages → « Souscrire un client » sur un package de l'agence B → **Confirmer** → contrat + facture créés, sans erreur « Agence hors de votre périmètre » ; la facture est rattachée à l'agence B.
- [ ] **Page Produits d'une agence** (`/countries/:id/agencies/:id/services`) → onglet Packages : le bouton « Souscrire un client » est présent (comme sur la page Produits du pays).
- [ ] **« Souscrire un client »** : le champ s'appelle « Vendeur » ; la liste propose les utilisateurs (pas de super-admin, pas de clients).
- [ ] **« Nouvelle souscription »** (onglet Prestations) : champ « Vendeur », même liste.
- [ ] **« Nouvelle inscription »** (formation) connecté en commercial / caissier : « Vendeur » présélectionné sur soi-même, modifiable ; choisir un autre utilisateur → l'inscription lui est attribuée.
- [ ] **Téléphone** (ou fenêtre étroite) sur un **pays** : pas de liste de sous-menus sous la carte pays ; le menu ☰ ne liste que le menu du pays (sans doublon), avec « Mon profil » en bas.
- [ ] **Téléphone** : depuis une agence / un département / un pays → menu utilisateur → **Profil** puis **Paramètres** → le menu ☰ garde le menu de l'espace.
- [ ] Rappel (règle métier inchangée) : connecté en **commercial**, le vendeur choisi dans « Nouvelle souscription » est remplacé par le commercial lui-même côté backend.
- [ ] **Recette des lots `29_10/` et `29_10(2)/`** s'ils n'étaient pas encore passés.
