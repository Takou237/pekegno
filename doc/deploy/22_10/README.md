# Déploiement + recette — 22/10/2026 (commissions par rôle, périmètres, validation, comptabilité par produit)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(pièges §3.1 → §3.9 — relire avant d'agir, surtout §3.2 Importer,
§3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 17/10/2026 appliqué** (`17_10/`, dernière
migration `2026_10_17_000001_add_amount_to_payment_proofs_table`).
Si un lot précédent (13/10 → 17/10) n'est pas encore passé en prod,
l'appliquer **d'abord** (voir leurs README), puis enchaîner celui-ci.
Contrôle : `SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;`

## 1. Ce qui change (code poussé sur GitHub, branche `master`)

| # | Changement | Partie |
|---|---|---|
| 1 | **Réglages → onglet Commissions** : commission par défaut (déplacée depuis Général) + **règles de commission** (assiette : vente, renouvellement, upgrade, CA mensuel par paliers, croissance vs N-1, prime manuelle ; cible : tous les produits / formations / packages / prestations, un élément précis ou une catégorie ; % / montant fixe / paliers) **attribuées aux rôles** (vue « Par rôle »). Une règle reste active jusqu'à modification ou désactivation | Backend + Frontend + Base |
| 2 | **Renouvellements** : règle sur le N-ième renouvellement (1 = premier, 3 = troisième…) ou à chaque renouvellement, option « à date ». Pas de cumul : la règle du N-ième remplace « chaque renouvellement ». L'équipe (community manager) est retrouvée en remontant la chaîne des contrats renouvelés | Backend |
| 3 | **Grille de rémunération en base** (18 règles : commerciaux, formateurs, community managers, chef Pekegno Agency, chefs d'agence, primes à définir) — les règles « à définir / à préciser » sont **inactives** | Base (`seed-commission-rules-2026-10-22.sql`) |
| 4 | Dès qu'un rôle porte une règle active, le **taux par défaut (20 %)** ne s'applique plus aux vendeurs de ce rôle (pas de double rémunération) | Backend |
| 5 | **Promotions** : une promo est valable **toute la journée de fin** (avant : expirée dès minuit) ; le serveur applique le **prix promotionnel** même si l'écran envoie le prix normal → facture, comptabilité et commissions au prix promo | Backend |
| 6 | **Validation des factures / preuves de paiement** : réservée à **super-admin, directeur général, caissier** (retirée à tout autre rôle, impossible à réattribuer depuis Rôles & permissions). Le DG valide **les factures de son pays** ; ses propres ventes sont **validées directement** | Backend + Frontend + Base |
| 7 | **Périmètres** : chef d'agence = son agence ; chef de département = son département ; DG = **son pays** (champ « Pays attribué » dans Utilisateurs). Listes factures / comptabilité / dépenses / abonnements / prospects / audit limitées à l'espace. Sélecteurs Pays/Agence/Département réservés au super-admin (DG : Agence/Département de son pays) | Backend + Frontend |
| 8 | **Ventes** des chefs et du DG : dans leur espace uniquement (vente hors périmètre refusée). Création rapide réservée au super-admin et au DG ; « Nouvelle facture » du DG ouvre la facture dans son pays | Backend + Frontend |
| 9 | **Rôles personnalisés** : menu construit depuis les permissions du rôle (plus d'interface générique avec « accès non autorisé ») | Backend + Frontend |
| 10 | **Clients globaux** : tout le personnel retrouve tous les clients (recherche insensible à la casse). Formulaires « Nouveau client » (vente, inscription, souscription, création rapide, page Clients, nouvel apprenant) : **tous les champs obligatoires** | Backend + Frontend |
| 11 | **Nouvelle facture** : Type = Produits / Formations / Packages / Prestations (filtre la recherche) ; une ligne Formation inscrit le client ; plus de « Créer XXX » sur le champ Client ; le **commentaire** est imprimé sur la facture | Backend + Frontend |
| 12 | **Comptabilité → onglet « Par produit »** : tout le catalogue (y compris les éléments créés ensuite), quantités, facturé, encaissé **par moyen de paiement** | Backend + Frontend |
| 13 | Lot récupéré du dépôt (pull du 22/10) : sessions de formation synchronisées, auteur de la facture (`created_by`), sélecteur de formateur, file des validations / preuves, pagination de l'audit | Backend + Frontend + Base |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-10-22.sql` | Les **7 migrations** du 22/10 (table `training_sessions_synced`, `invoices.created_by` + rattrapage, colonnes/tables des règles par rôle, droits `invoices.valider` = super-admin + DG + caissier) + lignes `migrations` | Importer **en 1er** |
| `seed-commission-rules-2026-10-22.sql` | Les **18 règles** de la grille + leurs rôles (miroir de `DefaultCommissionRulesSeeder`) | Importer **en 2e** |
| `frontend-dist.zip` | Build admin du 22/10 (`VITE_API_URL=https://pekegnogroup.com/api`), `.htaccess` inclus | Extraire sur `/plateforme.pekegnogroup.com` |
| `compute-role-commissions.php` | One-shot : calcule les primes mensuelles (CA par paliers, croissance) d'un mois, puis **supprimer** | Après le déploiement, puis chaque début de mois |
| `README.md` | Ce fichier | — |

**Pas de rebuild `vendor/`** (`composer.json`/`composer.lock` inchangés —
vérifié par diff depuis le déploiement du 17/10). **Rien à changer dans `.env`.**

Validé avant livraison :
- `migration-2026-10-22.sql` + `seed-commission-rules-2026-10-22.sql` importés
  **2 fois de suite** sur un vrai **PostgreSQL 9.6** reconstruit dans l'état de la
  prod (`schema.sql` → lots 28/09 … 17/10) : zéro erreur, `INSERT 0 0` au rejeu ;
- schéma obtenu **identique** à celui créé par Laravel (129 colonnes, index et
  contraintes comparés) ;
- `invoices.valider` = caissier, direction-generale, super-admin uniquement ;
  18 règles (activation conditionnelle Livres / Canva Pro vérifiée) ;
- `tsc -b --noEmit` OK, build OK, `php -l` OK, tests backend : aucun nouvel
  échec (les échecs restants préexistent : extension GD absente de l'image de
  test + 7 tests déjà en échec avant ce lot).

## 3. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Base — schéma + droits** : phpPgAdmin → base → onglet **Importer** →
   `22_10/migration-2026-10-22.sql`. Attendu : succès (`CREATE TABLE`, `ALTER TABLE`,
   `UPDATE n`, `DELETE n`, `INSERT 0 n` ; au rejeu : `NOTICE … already exists, skipping` et `INSERT 0 0`).
3. **Base — règles de commission** : même onglet **Importer** →
   `22_10/seed-commission-rules-2026-10-22.sql`. Attendu : succès (`INSERT 0 1` × 16 ;
   `INSERT 0 0` si rejoué).
4. **Contrôles** (boîte SQL → `SELECT` uniquement) :
   ```sql
   SELECT migration FROM migrations WHERE migration LIKE '2026_10_22%' ORDER BY migration;  -- 7 lignes
   SELECT r.name FROM role_permission rp JOIN roles r ON r.id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id WHERE p.name = 'invoices.valider' ORDER BY 1;
     -- attendu : caissier, direction-generale, super-admin (et rien d'autre)
   SELECT count(*) FROM commission_rules WHERE basis IS NOT NULL;  -- ≥ 18
   SELECT to_regclass('public.training_sessions_synced'), to_regclass('public.commission_rule_role');  -- 2 non NULL
   ```
5. **Code backend** : `git push` fait → cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
6. **Caches** (nouvelles routes) : SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (§3.9), puis **vider l'OPcache** via `reset-opcache.php` (§3.4) et
   **supprimer** le fichier.
7. **Frontend admin** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `22_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (fichiers cachés).
8. Navigateur : **Ctrl+Maj+R**, puis recette ci-dessous.
9. **Directeur(s) général(aux)** : Réglages → Utilisateurs → Modifier chaque DG →
   **Pays attribué**. Sans pays, un DG garde la vue groupe (comportement d'avant).

Retour arrière : restaurer la sauvegarde (1), repointer le dépôt sur le commit
précédent, réuploader l'ancien build. Les nouvelles tables/colonnes sont sans
effet sur l'ancien code (attention : la restauration rend aussi
`invoices.valider` aux rôles qui l'avaient).

## 4. Primes mensuelles (pas de cron sur o2switch)

Les règles « CA mensuel » (commerciaux) et « Croissance » (chefs d'agence) se
calculent par mois. Sans tâche planifiée sur le serveur, au **début de chaque
mois** : uploader `compute-role-commissions.php` dans `backend/public/`, ouvrir
`https://pekegnogroup.com/compute-role-commissions.php` (mois précédent) ou
`…?period=AAAA-MM`, lire le résultat (« n prime(s) créée(s) »), **supprimer le
fichier**. Relançable sans doublon. Les primes apparaissent dans Commissions
(statut « calculée ») pour validation puis paiement.

## 5. Recette

- [ ] **Réglages → Commissions** : commission par défaut + liste des 18 règles (badge « Inactive — à compléter » sur les règles à définir) ; vue **Par rôle** : cocher/décocher une règle pour un rôle.
- [ ] Nouvelle règle « Tous les produits » 10 % pour un rôle → une vente de produits par un utilisateur de ce rôle génère 10 % des **lignes produit** seulement.
- [ ] **Promotion** finissant aujourd'hui sur un produit 8 000 → 6 000 : la vente est facturée 6 000, la comptabilité affiche 6 000, la commission est calculée sur 6 000.
- [ ] **Validation** : un chef d'agence n'a plus « Validation » ; le DG et le caissier valident ; Rôles & permissions → cocher « Valider les factures » sur un autre rôle → la case n'est pas conservée.
- [ ] **DG** (pays attribué) : arrive sur son pays ; sélecteurs limités à Agence/Département ; une facture d'un autre pays est introuvable ; « Création rapide → Nouvelle facture » ouvre la facture dans son pays ; sa vente est validée directement.
- [ ] **Chef d'agence / de département** : arrive sur son espace, pas de sélecteurs Pays/Agence/Département, pas de Création rapide ; ses ventes partent en validation.
- [ ] **Commercial** : « Nouvelle vente » → le champ Client trouve n'importe quel client (même en minuscules) ; « Nouveau client » exige tous les champs.
- [ ] **Nouvelle facture** : Type Produits / Formations / Packages / Prestations filtre la recherche ; le commentaire saisi apparaît sur la facture imprimée.
- [ ] **Caissier → Comptabilité → « Par produit »** : tous les produits / formations / packages / prestations, colonnes par moyen de paiement ; un produit créé ensuite apparaît aussitôt.
- [ ] **Rôle personnalisé** (Rôles & permissions → nouveau rôle avec quelques droits) : à la connexion, le menu ne montre que les pages autorisées.
