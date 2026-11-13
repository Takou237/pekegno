# Deploiement + recette - 12/11/2026 (branche `corrections`)

Kit du lot **12/11** : cloture des Lots 3 (Administration par pays, publicite
Pekegno, rentabilite evenement, pass-through) et 7 (presences par seance,
creance echue), plus la matrice de droits T0.6.

Procedures generales et pieges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 import SQL, §3.4 OPcache, §3.9 cache de routes).

Etat de depart attendu : **lot `08_11/` applique**
(derniere migration : `2026_11_10_000003`).

> **Prerequis staging** : le domaine `staging.pekegnogroup.com` n'existe pas
> encore (Lot 10, T10.1 « A FAIRE »). Ce dossier sert a deployer le lot des que
> l'environnement de test (copie de la prod + base anonymisee) est en place, ou
> a preparer la production apres recette. Ne pas importer le SQL sans le code
> de `corrections`.

> **Ce lot vient de la branche `corrections`.** Si l'environnement suit
> `master`, fusionner `corrections` dans `master` (etape 0) avant tout.

## 1. Ce qui change

| # | Changement | Ref. | Partie |
|---|---|---|---|
| 1 | **Entite Administration par pays** : un type d'agence `administration` porte les recettes et depenses de structure, separees des KPI operationnels | T3.1-T3.4 | Backend + Frontend |
| 2 | **Publicite Pekegno** : campagnes locales (100 % de l'agence cible) ou nationales (au prorata du CA de la branche) ; cout et resultat avant/apres publicite dans les rapports d'agence | T3.8-T3.11 | Backend + Frontend |
| 3 | **Pass-through** : le budget pub facture au client n'est ni du CA ni une depense d'exploitation ; une depense rattachee a la facture est marquee `is_pass_through` | T3.12 | Backend |
| 4 | **Rentabilite evenement** : une depense rattachee au service « Seminaire (Pass) » ; resultat = ventes du seminaire - depenses rattachees | T3.14 | Backend + Frontend |
| 5 | **Presences par seance** : date de seance sur l'appel, unicite (session, module, date, apprenant), feuille de presence datee + export | T7.3 | Backend + Frontend |
| 6 | **Creance echue** : echeance = `due_date` sinon date facture + delai agence (30 j par defaut, reglable) ; notification interne quotidienne, pas de relance client | Lot 7 | Backend |
| 7 | **Droits T0.6** : `community-manager` executant de prestations (plus de vente) ; `caissier` sans suppression de client ni ecriture comptable | T0.6 | Backend |
| 8 | **Motif de rejet ferme** sur les preuves de paiement (`rejection_code`, dont « Date echue ») | B25 | Backend + Frontend |
| 9 | **Indicatifs pays** rattrapes (`+237`, `+225`) pour la validation des telephones | L5 | Backend |

| Partie | Action |
|---|---|
| Base de donnees | `migration-2026-11-12.sql` : **9 migrations** + lignes `migrations` (rejouable, une transaction) |
| Donnees | **Creer une agence `administration` par pays** (T3.1) + ses caisses ; option : delai d'echeance par agence |
| Routes | **nouvelles** (campagnes pub, presences datees, echeance) -> **vider le cache de routes** |
| `vendor/` | **aucun changement attendu** (verifier `git diff --stat 08_11..HEAD -- backend/composer.json backend/composer.lock`) |
| `.env` | rien d'obligatoire. Verifier que le scheduler tourne (etape 6) |
| Frontend admin | rebuild avec l'URL d'API **de l'environnement cible** (`.htaccess` inclus) |
| Frontend client | non modifie |

> **Ordre critique** : le code lit les nouvelles colonnes/tables (campagnes,
> `due_date`, `session_date`, `is_pass_through`, `rejection_code`). Entre le
> `git pull` (etape 1) et l'import SQL (etape 2), les pages concernees renvoient
> « Server Error ». Enchainer 1 et 2 sans attendre, hors des heures de vente.

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-11-12.sql` | 9 migrations + lignes `migrations` (rejouable, une transaction) | phpPgAdmin -> **Importer**, **juste apres** le `git pull` |
| `frontend-dist.zip` | Build admin du 12/11 (**a generer**, cf. etape 5) | Extraire sur le docroot du frontend |
| `README.md` | Ce fichier | - |

## 3. Base de donnees

Migrations couvertes (dans l'ordre) :

| Ordre | Migration |
|---|---|
| A | `2026_11_12_000001_backfill_country_phone_codes` |
| B | `2026_11_12_000002_add_rejection_code_to_payment_proofs_table` |
| C | `2026_11_12_000003_apply_role_permission_matrix` |
| D | `2026_11_12_000004_add_pass_through_to_expenses` |
| E | `2026_11_12_000005_add_service_id_to_expenses` |
| F | `2026_11_12_000006_create_ad_campaigns_table` |
| G | `2026_11_12_000007_add_session_date_to_attendances_table` |
| H | `2026_11_12_000008_add_administration_type_to_agencies` |
| I | `2026_11_12_000009_add_due_date_to_invoices_table` |

Deux voies possibles :

- **Staging (recommande)** : `php artisan migrate --force` puis verifier
  `php artisan migrate:status | grep 2026_11_12`.
- **Import SQL (production / phpPgAdmin)** : importer
  `migration-2026-11-12.sql` via l'onglet **Importer** (jamais copier-coller).

Sauvegarder la base avant (phpPgAdmin -> Exporter, ou `pg_dump`). Ne pas
rejouer `php artisan migrate` apres un import SQL : les lignes `migrations`
sont deja ecrites.

Pour les presences historiques, `session_date` reste `NULL` : les dater
manuellement si l'on veut les retrouver dans la feuille par seance.

## 4. Deploiement (ordre)

0. **Code** : fusionner `corrections` dans la branche suivie par l'environnement
   (ou deployer `corrections` directement sur staging).
1. `git pull` sur le serveur (cPanel -> Git Version Control, ou SSH).
2. Importer `migration-2026-11-12.sql` **immediatement** (ou `artisan migrate --force`).
3. `composer install --no-dev --optimize-autoloader` **seulement si**
   `composer.lock` a change (sinon inutile).
4. Vider les caches :
   `php artisan optimize:clear` (ou `route:clear`, `config:clear`, `view:clear`,
   `cache:clear`) puis recharger OPcache (§3.4 du README general).
5. **Frontend** : rebuild et upload (etape 5 ci-dessous), puis vider le cache
   navigateur / CDN. Verifier que le bundle ne contient que l'URL d'API cible.
6. **Scheduler** : verifier que le cron `* * * * * php artisan schedule:run`
   tourne. Nouvelle tache : `invoices:check-overdue` chaque jour a **06:45**
   (a cote de `agency:check-renewals` 06:15 et `contracts:refresh-status` 06:30).
   Sans ce cron, aucune notification de creance echue n'est emise.
7. **Donnees T3.1** : creer une agence de type `administration` par pays
   (Cameroun, Cote d'Ivoire) + ses caisses, puis affecter les utilisateurs
   concernes. Option : regler `agency_invoice_due_days:{agencyId}` (defaut 30).
8. Demander aux utilisateurs de se reconnecter (jetons/permissions en cache) et
   de vider le cache navigateur.

## 5. Frontend

Build avec l'URL d'API **de l'environnement vise** (ne pas reutiliser un build
d'un autre environnement) :

```powershell
cd frontend
$env:VITE_API_URL = "https://<API_DE_L_ENVIRONNEMENT>/api"
npm run build
Compress-Archive -Path dist\* -DestinationPath ..\doc\deploy\12_11\frontend-dist.zip -Force
```

```bash
cd frontend
VITE_API_URL="https://<API_DE_L_ENVIRONNEMENT>/api" npm run build
# zip de dist/ (inclure .htaccess)
```

Verifier : `tsc -b` + `vite build` OK, `.htaccess` present dans `dist/`, et
l'URL d'API est la seule du bundle.

## 6. Recette

Checklist de reception (18 points client + scenarios par role) :
`doc/recette/RECETTE_18_POINTS_STAGING_2026-11-12.md`.

Points specifiques a ce lot :

- Creer une campagne **locale** : 100 % du cout sur l'agence cible ; une
  campagne **nationale** Academy : repartition au prorata du CA Academy.
- Rapport d'agence : resultat **avant** et **apres** publicite.
- Une depense pass-through ne doit apparaitre ni dans le CA ni dans les
  depenses d'exploitation ; la rentabilite seminaire = ventes - depenses
  rattachees.
- Feuille de presence : deux appels a deux dates differentes pour le meme
  module/apprenant sont acceptes ; meme date = un seul enregistrement.
- Facture avec `due_date` depassee (ou date facture + 30 j) -> notification
  interne au commercial/chef d'agence a la prochaine execution du scheduler.

## 7. Retour arriere

Le SQL est **additif** (colonnes, table, index, contraintes). En cas de
probleme, revenir au commit precedent (`git checkout <commit>` / redeployer le
build precedent) **sans** supprimer les colonnes : elles sont ignorees par
l'ancien code. Ne pas rejouer `migrate:rollback` en production.

## 8. Echecs de tests connus (ne pas confondre avec une regression)

Cf. `CLAUDE.md` : ~31 tests `GD extension is not installed` (image Docker
locale), 5 tests de preuve de paiement obligatoire pour `responsable-agence`,
1 test `ClientPackageSubscriptionTest` (avance plafonnee). Verifier que la
liste ne change pas avant/apres le lot.
