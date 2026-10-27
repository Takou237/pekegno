# Déploiement + recette — 27/10/2026 (rattachement utilisateurs, emails clients coupés, preuve de paiement chef, sessions libres, prestations inter-agences)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 22/10/2026 appliqué** (`22_10/`).
Contrôle (boîte SQL, `SELECT` uniquement) :
```sql
SELECT migration FROM migrations WHERE migration LIKE '2026_10_22%' ORDER BY migration;  -- 7 lignes
```
Si 0 ligne : appliquer **d'abord** `22_10/README.md` §3 étapes 1 → 4.
Le lot du 26/10 n'a **aucun SQL** : s'il n'est pas encore passé, il est couvert
par celui-ci (le `frontend-dist.zip` du 27/10 remplace ceux du 22/10 et du 26/10,
le `git pull` ramène aussi le code du 26/10).

## 1. Ce qui change

Code : commit `f93055b` (« update codebase », déjà sur GitHub `master`) **+ les
modifications du 27/10 ci-dessous, à commiter et pousser sur GitHub avant
l'étape 2** (le serveur récupère le code depuis GitHub).

| # | Changement | Partie |
|---|---|---|
| 1 | **Utilisateurs → Créer** : l'**agence est obligatoire** (sauf super-admin / directeur général) — page Utilisateurs et modale des pages Équipes | Frontend |
| 2 | **Utilisateurs → Modifier** : champs **Agence** et **Département** (préremplis). Le rattachement simple est remplacé ; les affectations de chef (agence / département) sont conservées ; la fiche commerciale suit l'agence ; un chef ne peut pas rattacher hors de son périmètre (403) ; département ≠ agence refusé (422) | Backend + Frontend |
| 3 | **Commercial sans agence** : l'onglet **Formations** du catalogue (`/catalog/services`) s'affiche (toutes les formations, agence choisie dans la modale d'inscription) | Frontend |
| 4 | **Emails aux clients coupés** : tout email dont un destinataire est un compte `client` est annulé avant envoi (bienvenue, factures, rappels de contrat, mot de passe oublié, code 2FA…) et journalisé dans `storage/logs/laravel.log` (« Email client non envoyé »). Le staff reçoit toujours ses emails. Réactivation : `CLIENT_EMAILS_ENABLED=true` dans `backend/.env` | Backend |
| 5 | **Preuve de paiement obligatoire pour le chef d'agence** : Vente rapide (avant : commercial seulement) et **Nouvelle souscription de prestation** (montant encaissé + moyen + preuve : la souscription est créée puis soumise directement, facture en attente du caissier). Nouvelle facture / Inscription / Souscription package : déjà le cas (`f93055b`) | Frontend (backend `f93055b`) |
| 6 | **Sessions de formation libres** : plusieurs sessions d'une même formation dans la même agence (y compris aux mêmes dates) — plus de 409 « Cette session existe déjà dans cette agence » | Backend |
| 7 | **Nouvelle souscription de prestation inter-agences** : le sélecteur Agence liste **toutes les agences** (avec le pays), les prestations proposées sont celles de l'agence choisie (`/prestation-offers?for_sale=1`), la souscription d'une offre d'une autre agence n'est plus refusée (403) ; le vendeur garde l'accès à la fiche créée. Les listes de gestion restent limitées au périmètre | Backend + Frontend |
| 8 | **Nouvelle prestation (offre)** : sans la permission `countries.consulter`, plus de toast « Vous n'avez pas les droits nécessaires » (le bloc « Déployer aussi dans d'autres pays » reste vide). Voir étape 3 pour rendre la permission au chef | Frontend |
| 9 | Correctifs de build du commit `f93055b` : `EmployeePicker` restauré (fiches prestation / actions), remise de souscription package réellement transmise à l'API (`discount_type` / `discount_value`), imports inutilisés | Frontend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration** (`backend/database` inchangé depuis le 22/10) |
| Permissions | aucune nouvelle ; **contrôle** `countries.consulter` du chef (étape 3) |
| Routes | aucune nouvelle (cache de routes à vider quand même) |
| `vendor/` | **aucun changement** (`composer.json` / `composer.lock` inchangés) |
| `.env` | rien d'obligatoire : `CLIENT_EMAILS_ENABLED` absent = emails clients **coupés** |
| Frontend admin | `27_10/frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |

Validé avant livraison : `tsc -b --noEmit` OK, build OK ; tests backend
**518 OK / 39 KO** :
- 31 « GD extension is not installed » (image de test sans GD — aucun échec fonctionnel) ;
- 8 tests non mis à jour par `f93055b` (preuve de paiement désormais exigée pour
  une vente de chef d'agence : `ManagerSalesTest`, `InterAgencySaleTest`,
  `Phase5BilanTest`, `Phase3ValidationWorkflowTest`, `ClientPackageSubscriptionTest`) —
  comportement voulu, ce sont les tests qui sont à aligner.

Nouveaux tests : `UserAssignmentUpdateTest` (6), `BlockClientEmailsTest` (3),
`ChiefPrestationOfferTest` (3), `TrainingSessionSyncTest` (+1).

## 2. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : (code du 27/10 commité et poussé sur GitHub) cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**. Vérifier que le
   dernier commit affiché est celui du 27/10 (après `f93055b`).
3. **Permission pays du chef d'agence** (boîte SQL, `SELECT`) :
   ```sql
   SELECT p.name FROM role_permission rp JOIN roles r ON r.id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id
    WHERE r.name = 'responsable-agence' AND p.name IN ('countries.consulter', 'cities.consulter');
   -- attendu : 2 lignes
   ```
   Si moins de 2 lignes : onglet **Importer** → `15_10/seed-permissions-chefs-2026-10-15.sql`
   (rejouable, n'ajoute que les lignes manquantes).
4. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** : uploader `doc/deploy/reset-opcache.php` dans
   `backend/public/`, ouvrir `https://pekegnogroup.com/reset-opcache.php`
   → « OPcache vidé avec succès » → **supprimer le fichier**.
   ⚠️ Sans ce vidage, le blocage des emails clients ne s'applique pas.
5. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `27_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
6. Navigateur : **Ctrl+Maj+R**, puis recette.

Retour arrière : repointer le dépôt sur `f93055b` (ou `775b36f`), vider caches
+ OPcache, réuploader `26_10/frontend-dist.zip`. Aucune donnée à restaurer
(pas de SQL ; les rattachements modifiés via « Modifier l'utilisateur » restent).

## 3. Recette

- [ ] **Utilisateurs → Créer** un caissier sans agence → « L'agence est obligatoire. » ; un directeur général → agence non demandée (pays attribué).
- [ ] **Utilisateurs → Modifier** un utilisateur sans agence → choisir Agence + Département → enregistré, visible dans la colonne Agence ; modifier seulement le nom → rattachement inchangé.
- [ ] **Chef d'agence → Modifier** un de ses employés vers une autre agence → refusé (hors périmètre).
- [ ] **Commercial sans agence** → `/catalog/services` → onglet **Formations** visible avec les formations.
- [ ] **Emails clients** : créer un client avec une vraie adresse → aucun email reçu ; `laravel.log` contient « Email client non envoyé » ; créer un employé → email de bienvenue reçu.
- [ ] **Chef d'agence → Vente rapide** : bouton Créer désactivé sans preuve ; avec preuve → facture en attente.
- [ ] **Chef d'agence → Nouvelle souscription (prestation)** : Agence = liste de toutes les agences (avec pays) ; choisir une autre agence → ses prestations sont proposées ; montant encaissé + preuve obligatoires → souscription créée, soumise, facture en attente côté caissier ; la fiche s'ouvre sans 403.
- [ ] **Chef d'agence → Nouvelle prestation** (offre) : pas de toast « droits nécessaires », enregistrement OK.
- [ ] **Sessions** : créer 2 sessions de la même formation dans la même agence (mêmes dates) → les deux sont créées.
- [ ] **Souscription package** avec remise → la remise apparaît sur la facture.
- [ ] **Fiche prestation / action** : le sélecteur d'employé (assigné, équipe) fonctionne.
