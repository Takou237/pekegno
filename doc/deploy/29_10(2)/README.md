# Déploiement + recette — 29/10/2026 (2) (Wave, rapports vendeurs, menus agence/département, sessions de formation)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 29/10/2026 (`29_10/`)** — appliqué ou non.
Le lot `29_10/` n'a **aucun SQL** : s'il n'est pas encore passé, il est couvert
par celui-ci (le `git pull` ramène son code, le `frontend-dist.zip` de
`29_10(2)/` remplace celui de `29_10/`). Faire quand même sa **recette**.

## 1. Ce qui change

Code :
- commit `56aa6db` (déjà sur GitHub `master`, pull du 29/10) ;
- + les modifications locales de ce lot (menus, sessions, rapport mensuel par
  agence) — **à commiter et pousser sur `master` avant le déploiement** (voir §2,
  étape 0).

| # | Changement | Partie |
|---|---|---|
| 1 | **Paiement Wave** : nouveau mode `wave` accepté partout (factures, versements, preuves de paiement, inscriptions, souscriptions, prestations) ; numéro du payeur obligatoire comme pour OM / MoMo | Backend + Frontend |
| 2 | **Rapport commercial / rapport mensuel** : sélecteur de vendeurs = tous les comptes staff (nouvelle route `GET /commercials/report/options`) ; ventes du vendeur comptées aussi par `seller_user_id` | Backend + Frontend |
| 3 | **Recherche commerciaux / employés** (`/commercials/search`, `/employees/search`) en mode autocomplétion | Backend |
| 4 | **Responsive agence + département** : le menu ☰ affiche le menu de l'espace (Vue d'ensemble, Départements… / Tableau de bord, Prospects…) au lieu du menu principal ; la barre d'onglets horizontale sous la carte est masquée sur mobile/tablette | Frontend |
| 5 | **Menu « Clients »** dans l'agence (nouvelle route `…/agencies/:agencyId/clients`) et dans les départements Academy / Boutique ; liste ↔ fiche client restent dans l'espace courant | Frontend |
| 6 | **Rapport mensuel dans l'agence** (onglet après Commerciaux, `…/agencies/:agencyId/monthly-report`) : vendeurs limités à cette agence (paramètre API `agency_id` sur `/commercials/report/options`, borné au périmètre de l'utilisateur) | Backend + Frontend |
| 7 | **Sessions d'une formation globale** : la fiche formation d'un département et le formulaire « Nouvelle inscription » de la page Apprenants affichent toutes les sessions de la formation, même organisées par une autre agence (avant : « 0 session » alors que la carte du catalogue en affichait 2 → commerciaux / caissiers ne pouvaient pas choisir de session) | Frontend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration** (`backend/database` inchangé depuis le 22/10). `wave` est stocké dans des colonnes `varchar` sans contrainte (`invoices.payment_type`, `invoice_payments.payment_method`, `payment_proofs.payment_method`) — vérifié |
| Permissions | **aucune nouvelle** : `commercials.reporting` et `clients.consulter` sont déjà accordées aux chefs d'agence / de département (seed du 13/10) |
| Routes | 1 nouvelle (`/commercials/report/options`) → **vider le cache de routes obligatoirement** |
| `vendor/` | **aucun changement** (`composer.json` / `composer.lock` inchangés) |
| `.env` | rien |
| Frontend admin | `29_10(2)/frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | modifié par le pull (Wave) mais **non déployé** en prod → rien à faire |

Validé avant livraison : `tsc` + build OK ; tests backend ciblés
(rapports, inscriptions, sessions) **50/50 OK**. Suite complète : 558 OK,
6 KO **déjà présents avant ce lot** (`ManagerSalesTest`, `Phase3ValidationWorkflowTest`,
`Phase5BilanTest`, `ClientPackageSubscriptionTest` : 422 au lieu de 201 à la
création de vente — tests non mis à jour depuis la règle d'avance obligatoire du 26/10).

## 2. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0
   (il doit être postérieur à `56aa6db`).
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** : uploader `doc/deploy/reset-opcache.php` dans
   `backend/public/`, ouvrir `https://pekegnogroup.com/reset-opcache.php`
   → « OPcache vidé avec succès » → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `29_10(2)/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
5. Navigateur : **Ctrl+Maj+R**, puis recette.

Aucun SQL à importer. Contrôle facultatif (boîte SQL, `SELECT` uniquement) —
la dernière migration doit rester celle du 22/10 :
```sql
SELECT migration FROM migrations ORDER BY id DESC LIMIT 5;
```

Diagnostic si le sélecteur de vendeurs du rapport mensuel reste vide : F12 →
Network → requête `commercials/report/options` :
- 404 → cache de routes non vidé / backend pas à jour ;
- 403 → le rôle n'a pas `commercials.reporting` ;
- liste vide depuis une agence → aucun compte staff affecté à cette agence.

Retour arrière : repointer le dépôt sur `6981c67` (lot `29_10/`), vider caches +
OPcache, réuploader `29_10/frontend-dist.zip`. Aucune donnée à restaurer (pas
de SQL ; les paiements déjà enregistrés en `wave` restent lisibles comme « mobile »
dans les totaux de recettes).

## 3. Recette

- [ ] **Wave** : vente rapide / facture / versement avec « Wave » → numéro du payeur exigé, enregistrement OK, reçu imprimable.
- [ ] **Rapport mensuel** (menu principal) : le sélecteur propose tous les comptes staff ; un vendeur ayant vendu via `seller_user_id` voit ses ventes.
- [ ] **Agence → Rapport mensuel** : seuls les vendeurs de l'agence sont proposés.
- [ ] **Agence → Clients** et **Département Academy → Clients** : liste affichée ; clic sur l'œil → fiche client ; « Retour » revient à la liste de l'espace.
- [ ] **Téléphone** (ou fenêtre étroite) sur une agence puis un département : pas de barre d'onglets sous la carte ; le menu ☰ liste les sous-menus de l'espace.
- [ ] **Formation globale** avec sessions dans une agence A, ouverte depuis le département Academy d'une agence B → les sessions s'affichent ; « Nouvelle inscription » les propose. Idem en commercial / caissier.
- [ ] **Recette du lot `29_10/`** si celui-ci n'était pas encore passé.
