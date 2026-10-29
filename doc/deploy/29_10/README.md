# Déploiement + recette — 29/10/2026 (« Mes ventes » des chefs, libellé règles de commission, fiches employé/formateur synchronisées, utilisateurs par pays)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 27/10/2026 appliqué** (`27_10/`).
Le lot du 27/10 n'a **aucun SQL** : s'il n'est pas encore passé, il est couvert
par celui-ci (le `git pull` ramène son code, le `frontend-dist.zip` du 29/10
remplace celui du 27/10) — faire quand même son **étape 3** (contrôle de la
permission `countries.consulter` du chef d'agence).

## 1. Ce qui change

Code : commit `6981c67` (déjà sur GitHub `master`).

| # | Changement | Partie |
|---|---|---|
| 1 | **Factures / Créances d'une agence** : onglets **« Factures de l'agence » / « Mes ventes »**. Un chef d'agence / de département / DG voit aussi ses propres ventes faites pour une autre agence (vendeur, créateur ou commercial rattaché) et peut les suivre / encaisser. Paramètre API `mine=1` | Backend + Frontend |
| 2 | **Liste des commerciaux** : colonne Commission = **« Règles de commission »** (EN : « Commission rules ») quand une règle active est attribuée au rôle du compte, au lieu du taux par défaut de la fiche (20 %) qui ne s'applique plus. Affichage seulement : le calcul utilisait déjà les règles depuis le 22/10 | Backend + Frontend |
| 3 | **Modifier un utilisateur** : nom, prénom, email, téléphone et statut actif recopiés sur ses fiches commercial / formateur ; un changement d'agence déplace aussi la fiche formateur | Backend |
| 4 | **Supprimer un utilisateur** : ses fiches commercial / formateur sont désactivées et archivées (soft delete) — avant, elles restaient actives dans les listes des pays et agences | Backend |
| 5 | **Utilisateurs dans la vue d'un pays** : uniquement les comptes des agences du pays + la direction générale du pays (liste et modales d'affectation) | Backend + Frontend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration** (`backend/database` inchangé depuis le 22/10) |
| Permissions | aucune nouvelle |
| Routes | aucune nouvelle (cache de routes à vider quand même) |
| `vendor/` | **aucun changement** |
| `.env` | rien |
| Frontend admin | `29_10/frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |

Validé avant livraison : `tsc -b` + build OK.
Nouveau test : `UserGroupConsistencyTest` (4) ; `InterAgencySaleTest` et
`RoleCommissionRulesTest` complétés.

## 2. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est `6981c67`.
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** : uploader `doc/deploy/reset-opcache.php` dans
   `backend/public/`, ouvrir `https://pekegnogroup.com/reset-opcache.php`
   → « OPcache vidé avec succès » → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `29_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
5. Navigateur : **Ctrl+Maj+R**, puis recette.

Diagnostic si les commerciaux affichent encore « 20.00% » : F12 → Network →
requête `commercials` :
- pas de champ `commission_by_rules` → backend pas à jour / OPcache non vidé ;
- `commission_by_rules: true` mais 20 % affiché → ancien frontend (zip non extrait, cache navigateur) ;
- `commission_by_rules: false` → la fiche n'a pas de compte lié, ou le compte n'a pas
  un rôle portant une règle active. Contrôle (boîte SQL, `SELECT` uniquement) :
  ```sql
  SELECT c.first_name, c.last_name, c.user_id, r.name AS role
    FROM commercials c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN roles r ON r.id = u.role_id
   ORDER BY c.last_name;
  ```

Retour arrière : repointer le dépôt sur `6ba135c`, vider caches + OPcache,
réuploader `27_10/frontend-dist.zip`. Aucune donnée à restaurer (pas de SQL ;
les fiches archivées par une suppression d'utilisateur restent archivées).

## 3. Recette

- [ ] **Commerciaux** : les commerciaux dont le compte a le rôle `commercial` affichent « Règles de commission » ; une fiche sans compte garde son taux.
- [ ] **Chef d'agence → Factures** de son agence → onglet **Mes ventes** : sa vente faite pour une autre agence apparaît ; idem **Créances**.
- [ ] **Modifier** le nom d'un commercial / formateur → nouveau nom dans les listes Employés / Commerciaux / Formateurs du pays.
- [ ] **Modifier** l'agence d'un formateur → il apparaît dans les formateurs de la nouvelle agence.
- [ ] **Supprimer** un utilisateur commercial → sa fiche disparaît des listes du pays et de l'agence.
- [ ] **Pays → Utilisateurs** : seuls les comptes de ce pays (et son DG) apparaissent ; idem dans la modale d'affectation d'une agence.
