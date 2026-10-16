# Déploiement + recette — 16/10/2026 (lot A_FAIRE : facture produit, CA unifié, dépenses partout, souscription, suivi caissiers)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(pièges §3.1 → §3.9 — relire avant d'agir, surtout §3.2 Importer,
§3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lots 13/10 + 14/10 + 15/10 appliqués**
(`13_10/`, `14_10/`, `15_10/`).
Si l'un d'eux n'est pas encore passé en prod, l'appliquer **d'abord**
(voir leurs README), puis enchaîner celui-ci.

## 1. Ce qui change (code poussé sur GitHub, branche `master`)

| # | Changement | Partie |
|---|---|---|
| 1 | Facture : sélecteur **Service / Produit / Libellé libre** par ligne + recherche produits + **création d'un produit inexistant à la volée** (enregistré au catalogue de l'agence). Le libellé libre seul = produit sur la facture, sans permission particulière | Backend + Frontend |
| 2 | Vente rapide : mêmes capacités produit (services + produits du catalogue, libellé libre) | Frontend |
| 3 | Création d'apprenant **complète partout** (9 champs + agence + commercial référent, email normalisé) : inscription Academy, vente rapide, souscription pack/offre | Frontend |
| 4 | **CA unifié = encaissé net** (`paid_at`, hors pass-through) : CA mensuel, tops agences/commerciaux (dont vue d'ensemble, agence, pays) alignés sur le bilan du jour. Fini le graphique à 0 avec des factures partielles | Backend |
| 5 | **Côte d'Ivoire à 0** : repli libellé legacy + rattrapage `country_id`/`city_id` (ce dossier, SQL) | Backend + Base |
| 6 | **Dépenses partout** : cartes Dépenses + Net caisse sur dashboards caissier, pays, academy (+ détail par pays dans PEKEGNO GROUP) | Backend + Frontend |
| 7 | **« Nouvelle souscription »** partout (plus de « Nouvelle prestation ») + modale de souscription pack unifiée (avance/paiement/preuve comme une vente) | Frontend |
| 8 | **Suivi des ventes** : filtre « Vendeur (guichet) » + recherche commerciaux **et** employés → les actions des caissiers remontent (fini le suivi à 0) | Backend + Frontend |

**Permissions : aucun changement nécessaire.** `products.consulter` est déjà
accordé aux commerciaux/caissiers (recherche), `products.creer` reste réservé
aux chefs/admins (le bouton « Créer le produit » leur est réservé ; les autres
rôles utilisent le libellé libre, qui ne demande aucune permission).

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-10-16.sql` | Rattrapage `country_id`/`city_id` des agences + ligne `migrations` (données seules, **aucun changement de schéma**) | Importer **en 1er** |
| `frontend-dist.zip` | Build admin du 16/10 (`VITE_API_URL=https://pekegnogroup.com/api`), `.htaccess` inclus | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

**Pas de rebuild `vendor/`** (`composer.json`/`composer.lock` inchangés —
vérifié par diff).

Validé avant livraison : `tsc --noEmit` OK, `php -l` OK,
`migration-2026-10-16.sql` rejoué sans erreur (2 passages, `INSERT 0 0`
au 2e), script de vidage testé en transaction annulée (voir
`reset-prod-fresh-2026-10-16.sql`, validé avec ROLLBACK : 2 admins, 0
partout en métier, config conservée).

## 3. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Base — rattrapage géo** : phpPgAdmin → base → onglet **Importer** →
   `16_10/migration-2026-10-16.sql`. Attendu : succès (`UPDATE n`,
   `INSERT 0 1`, ou `INSERT 0 0` si rejoué).
3. **Contrôles** (boîte SQL → `SELECT` uniquement) :
   ```sql
   SELECT COUNT(*) FROM agencies WHERE country_id IS NULL;  -- attendu : 0 (ou seulement des agences sans pays du tout)
   SELECT c.name, COUNT(a.id) FROM countries c LEFT JOIN agencies a ON a.country_id = c.id GROUP BY c.name ORDER BY 1;
   -- la Côte d'Ivoire doit avoir ≥ 1 agence ; son CA n'est plus à 0
   SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;  -- la 2026_10_16 en tête
   ```
4. **Code backend** : `git push` fait → cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
5. **Caches** : SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (§3.9), puis **vider l'OPcache** via `reset-opcache.php` (§3.4) et
   **supprimer** le fichier.
6. **Frontend admin** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `16_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (fichiers cachés).
7. Navigateur : **Ctrl+Maj+R**, puis recette ci-dessous.

Retour arrière : restaurer la sauvegarde (1), repointer le dépôt sur le commit
précédent, réuploader l'ancien build. Le rattrapage géo est sans effet sur
l'ancien code (il ne fait que remplir des FK).

## 4. Recette

- [ ] **Nouvelle facture** → ligne : sélecteur **Service / Produit / Libellé libre**. Choisir un produit → libellé + prix pré-remplis. Libellé libre + prix → facture créée (produit inexistant enregistré sur la facture).
- [ ] Chef d'agence → même écran → bouton **« Créer le produit »** : le produit est créé au catalogue puis sélectionné. Commercial : le bouton répond une erreur propre (permission réservée), le libellé libre reste utilisable.
- [ ] **Vente rapide** : la liste propose services ET produits (📦) ; libellé libre possible.
- [ ] **Nouvelle inscription** (commercial) : onglet « Créer un nouvel apprenant » = 9 champs complets ; création OK sans email (compte `…@sans-email.pekegno.local` généré).
- [ ] **CA mensuel** : une facture partielle encaissée partiellement apparaît dans le graphique (avant : invisible car non `paid`).
- [ ] **Côte d'Ivoire** : CA > 0 si l'agence ivoirienne a des encaissements ; plus de bandeau « aucune agence rattachée ».
- [ ] Dashboards **caissier / pays / academy** : carte **Dépenses** (+ Net caisse) affichée ; PEKEGNO GROUP : dépenses par pays visibles.
- [ ] Prestations : les boutons disent **« Nouvelle souscription »** ; souscrire à un pack = même tunnel qu'une vente (avance, paiement, preuve si commercial).
- [ ] **Suivi des ventes** : filtre **« Vendeur (guichet) »** présent ; filtrer par un caissier montre ses ventes (avant : 0).

## 5. Remise à neuf (optionnel, irréversible)

Pour repartir d'un réseau vierge : **sauvegarde**, puis importer
`doc/deploy/reset-prod-fresh-2026-10-16.sql` (onglet Importer). Ne restent que
`admin@pekegno.com` + `admin2@pekegno.com` (mot de passe : `12345678` dans les
2 cas) ; rôles, permissions, réglages et plan comptable conservés. Recréer
ensuite pays → agences → départements → utilisateurs depuis l'interface.
