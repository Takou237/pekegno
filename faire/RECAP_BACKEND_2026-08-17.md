# Récapitulatif Backend — Évolutions Phases 1 à 8

> Implémentation complète au backend PEKEGNO (Laravel) des évolutions définies dans `SPECIFICATION_EVOLUTIONS.md` / `TODOLIST_EVOLUTIONS.tex`.
> Suite de tests : **102 tests / 102 verts**, Pint propre, base locale (PostgreSQL) migrée et seedée.

---

## 1. Phase 1 — Bug recherche de factures + filtre par client

### Problème
Recherche de factures en erreur SQL `column "client_name" does not exist` (migration `client_name` non exécutée).

### Solution
- Exécution de la migration `2026_08_14_000001_add_client_name_to_invoices` sur la base cible.
- **Renforcement** de `InvoiceController::index` : la recherche ne dépend plus de la seule colonne `client_name` — ajout d'une recherche sur la **relation client** (prénom, nom, email) via `orWhereHas` :
  - `number LIKE %s%`, `client_name LIKE %s%`, `client.first_name/last_name/email LIKE %s%`.
- Filtre `client_id` existant conservé.

### Tests
`InvoiceSearchTest` (6) : recherche par numéro, par nom libre, par prénom/nom/email du client lié, non-retour des autres factures, filtre `client_id`.

---

## 2. Phase 2 — Paiement en tranches (max 3) + primes à l'encaissement + prime fixe par service

### Tranches
- **Plafond de 3 paiements par facture, avance comprise** (422 « Paiement en tranches limité à 3 ») — appliqué dans `InvoiceController::pay()` et à la création avec avance (`applyPayment`).
- Refus : paiement d'une facture déjà soldée, sur-paiement (`Le montant dépasse le reste à payer`), facture annulée.

### Primes à l'encaissement (règle métier nouvelle)
- **Chaque encaissement déclenche la commission** proportionnelle au montant encaissé (plus uniquement au paiement intégral).
- **Nouveau journal** `commission_payments` (migration `2026_08_15_000002`) : commercial_id, invoice_id, payment_id, service_id, amount, base_amount, rule (`percent` | `fixed` | `service_fixed`), rate, invoice_total, created_by.
- **Nouveau** `app/Services/CommissionService.php` :
  - `calculateForPayment(Invoice, paidAmount)` — règle **multi-lignes** : part du paiement par ligne selon son poids (`line_total / invoice_total`) ;
  - ligne avec service à **prime fixe** (`bonus_fixed`, migration `2026_08_15_000001`) → calculée **à part** : `bonus_fixed × paid/total` (la prime fixe prime sur le pourcentage du commercial) ;
  - sinon règle du commercial : `percent` → `% × part` ; `fixed` → valeur proratée sur la part ;
  - `recordForPayment(Invoice, Payment)` — écriture journal **idempotente par payment_id** + incrément de l'agrégat `invoices.commission_amount` + log d'activité.
- Points : **inchangés** — `PointsService::awardForSale` au paiement intégral uniquement (idempotent via `points_awarded`).

### Tests
`Phase2Test` (8) : 3 tranches max, avance = 1ᵉʳ versement, commission percent par tranche, fixed proratée, bonus_fixed qui prime, multi-lignes par poids, points seulement au soldé, idempotence par payment.

---

## 3. Phase 3 — Renforcement socle + Comptabilité

### 3a. Socle (clients, commerciaux, factures, stats, journalisation)
`Phase3Test` (12) :
- Inscription (`/auth/register`) → rôle `client` + numéro client ; CRUD clients/commerciaux + ajustement de points ;
- Facture avec avance puis paiement complet → **points + commission** ;
- Rejet sur-paiement / double paiement / paiement d'une facture annulée ;
- Promotions : chevauchement refusé, prix effectif recalculé ;
- Contrôle d'accès (rôle non autorisé → 403) ; `stats/overview` (CA, encaissés, avances, top commerciaux) ;
- Journalisation d'activité : login, changement de rôle, assignations, CRUD agence.

### 3b. Comptabilité (reporting global + par agence)
- **Migrations** `2026_08_15_000003` : `accounting_categories` (name, type income/expense, agency_id nullable = globale, is_system) + `accounting_transactions` (N° auto-incrément, agency_id, category_id, type, label, reference = n° facture, amount, client_id, invoice_id, transacted_at, operator_id, note, beneficiary, justification, index agency/date/type).
- **Journalisation automatique** (`AccountingService`) : chaque encaissement (avance incluse) crée une entrée `income` (« Facture {number} — versement », reference, client, montant, `transacted_at = paid_at`, opérateur). **Aucune écriture pour les factures annulées**.
- **`AccountingController`** : index (filtres agency/type/category/client/from/to/search + **totaux entrées/sorties/solde**), store manuel (sortie ⇒ `beneficiary` + `justification` requis), update, destroy (**transactions auto protégées**), categories CRUD (`AccountingCategoryController`, catégories système protégées).
- **Exports** : `ExportController::accounting` → **vrai `.xlsx`** (`AccountingExport`, Comptabilité `comptabilite-AAAA-MM-JJ.xlsx`).
- **Seeders** : catégorie système « Encaissement facture » ; permissions `comptabilite.*` + `accounting-categories.*` (super-admin, direction, responsable-agence, comptable, caissier lecture).

### Tests
`Phase3AccountingTest` (9) : paiement/avance → entrée comptable auto, sortie sans bénéficiaire/justification refusée, filtres + totaux, CRUD manuel, protection auto, protection catégories système, CRUD catégories agence, export xlsx.

---

## 4. Phase 4 — Menu Employés (discriminateur `kind`)

- **Migration** `2026_08_15_000004` : `commercials.kind` enum `commercial|employe` (défaut `commercial`).
- Modèle `Commercial` : `kind` en fillable + `scopeKind()`.
- **`CommercialController`** : `defaultKind()` par chemin (`api/employees*` → employe), filtres `kind` sur index/search/ranking, `availableUsers` inclut les **caissiers** pour les employés, contrôle rôle (caissier refusé pour un commercial).
- **Routes** `/api/employees*` (alias, permissions `employes.*`) + export `employees()` (CSV avec colonne `kind`).
- **Permissions** : groupe `employes.consulter/creer/modifier/supprimer/exporter` — super-admin, direction, responsable-agence, comptable.
- Prime/points : un employé lié à un compte (ex. caissier) est primé via `invoices.commercial_id` (distinct de `seller_user_id`).

### Tests
`Phase4EmployeesTest` (10) : création via `/employees`, kind par défaut, lien caissier (accepté employe / refusé commercial), filtre index, available-users, conversion commercial → employé, ranking filtré, export restreint, 403 caissier.

---

## 5. Phase 5 — Bilan du jour

- **Migration** `2026_08_17_000001` : `daily_balances` (agency_id, date, solde_initial, solde_final, unique agency+date) — **pas de cast date** (passe-partout SQLite).
- **Nouveau** `app/Services/BilanService.php` (partagé contrôleur + export) :
  - par service : nombre vendu + somme (`invoice_items`, factures **non annulées** du jour) ;
  - total services vendus ; encaissements **cash / mobile** (`invoice_payments.paid_at` du jour) — contrôle de cohérence `cash + mobile == total` (alerte si écart) ;
  - **dépense du jour** : sorties `accounting_transactions` du jour ;
  - **solde initial** : solde final stocké de la veille (fallback : encaissés de la veille) ; **solde final = encaissé − dépense** ; solde stocké pour chaîner les jours.
- **`BilanController::dailyBilan`** (GET `/api/bilans`, `bilans.consulter`) + **`ExportController::dailyBilan`** (GET `/api/exports/bilans`, xlsx `bilan-du-jour-AAAA-MM-JJ.xlsx`, `DailyBilanExport`).
- **Permissions** `bilans.consulter / exporter` : super-admin, direction, responsable-agence, caissier, comptable.

### Tests
`Phase5BilanTest` (13) : services + totaux, cash/mobile, factures annulées exclues, filtre agence, dépense → solde final, solde initial du jour précédent, chaîne des soldes stockés, alerte de cohérence, exclusion des jours précédents, permissions (403 client / OK caissier), export xlsx, stockage `DailyBalance`.

---

## 6. Phase 6 — Abonnements

- **Migration** `2026_08_15_000005` : `subscription_packs` (+ agency), `subscription_pack_services` (prix/mois par service), `subscriptions` (pack, agency, client, months, price_per_month, total_price, start_date, end_date, invoice_id nullable FK).
- **Modèles** : `SubscriptionPack`, `SubscriptionPackService`, `Subscription`.
- **Extraction** `app/Services/PaymentService.php` : `applyPayment` commun (plafond 3 tranches, commission par tranche, compta auto, points au soldé) — `InvoiceController` refactoré (17 tests Phase2/Phase3 toujours verts après extraction).
- **`SubscriptionController`** :
  - packs : CRUD complet, **exactement 4 services distincts** (422 sinon) ;
  - `store` → **génération automatique d'une facture** (`InvoiceNumberGenerator`, 1 ligne par service du pack avec `quantity = months`, prix/mois = somme des prix des services, total = prix × mois, commentaire récapitulatif) ; avance optionnelle via `PaymentService` ; le client lié doit avoir le rôle `client` ; pack inactif refusé ;
  - `renew` → **nouvelle facture**, période suivante (`end_date + 1 jour`) ;
  - index : filtres agency/client/**statut** (unpaid/partial/paid/cancelled via la facture liée).
- **Routes** `/api/subscription-packs*` + `/api/subscriptions*` (+ `/renew`) ; permissions `abonnements.consulter/creer/modifier/supprimer/renouveler` — responsable-agence : toutes ; caissier : consulter/creer/renouveler ; comptable : consulter.
- **Correction déploiement** : `packsStore` nécessitait `agency_id` → fallback `primaryAgency()` + règle nullable (le bug aurait fait 500 en prod).

### Tests
`Phase6SubscriptionsTest` (9) : pack 4 services exactement (3/5/doublon → 422), CRUD pack, store → facture (4 lignes × months, totaux, statut unpaid), avance → paiement + écriture comptable, rôle client requis, renew → nouvelle facture + période + 2ᵉ abonnement, filtres index par statut, permissions.

---

## 7. Phase 7 — Reporting commerciaux

- **Nouveau** `app/Services/CommercialReportService.php` (partagé contrôleur + export) : filtres `agency_id`, `commercial_id`, `kind`, `from`, `to` (défaut mois courant) ; par commercial/employé :
  - ventes + CA facturé (factures non annulées de la période) ;
  - CA encaissé + nombre de tranches (paiements `paid_at` de la période) ;
  - **commissions par tranche** (somme `commission_payments` de la période) ;
  - points gagnés (`CommercialPoint`) ; prospects créés ; clients convertis (clients distincts facturés) + **taux de conversion** (convertis / (convertis + prospects)) ;
  - totaux globaux + classement (ventes, puis CA encaissé) ; scope rôle : direction → tout, responsable-agence → agences assignées.
- **Nouveau** `CommercialReportController::report` → GET `/api/commercials/report` (permission `commercials.reporting`, route déclarée avant les bindings `{commercial}`).
- **Nouveau** `app/Exports/CommercialReportExport.php` : `ExportController::commercialReport` (GET `/api/exports/commercial-report`, xlsx `reporting-commercial-AAAA-MM-JJ-AAAA-MM-JJ.xlsx`, ligne TOTAL en gras).
- **Permissions** : action `reporting` du groupe `commercials` (label FR « Reporting ») — super-admin, direction, responsable-agence, comptable.

### Tests
`Phase7ReportingTest` (5) : agrégats ventes/encaissements/commissions (avance + tranche, 10 % → 1000 F), filtres kind/agence/commercial/période, prospects + points + conversion (33,3 %), export xlsx, 403 rôle client.

---

## 8. Phase 8 — Catégorie Séminaire (Pass Classique / Premium / VIP)

- **Migration** `2026_08_17_000002` : `services.is_seminar` (bool, défaut false) ; table `seminar_tiers` (service_id FK cascade, tier enum `classique|premium|vip`, label, price, description, **unique(service_id, tier)**) ; `invoice_items.pass_tier` + `pass_label` (trace du pass sur la ligne).
- **Nouveau modèle** `SeminarTier` ; `Service` : `is_seminar` (fillable + cast) + relation `seminarTiers()` ; `InvoiceItem` : `pass_tier`, `pass_label` en fillable.
- **`ServiceController`** (store/update, validé dans `Store/UpdateServiceRequest`) :
  - service non séminaire → pas de passes (suppression si désactivé) ;
  - séminaire sans `tiers` → **dérivation automatique** : Classique = prix de base, Premium = ×1,5, VIP = ×2,5 (« règle intelligente ») ;
  - `tiers` fournis → remplacés tels quels (modifiables).
- **`ServiceResource`** : expose `is_seminar`, `seminar_tiers`, `bonus_fixed` ; `seminarTiers` chargé par défaut sur l'index.
- **`InvoiceController::store`** : `items.*.pass_tier` (nullable, `in:classique,premium,vip`) → si service séminaire : `unit_price` = prix du pass (il prime ; `unit_price` devenu optionnel), trace `pass_tier` + `pass_label` ; 422 si pass sur service non séminaire, pass sans service, ou pass inexistant.
- **Catégorie « Séminaire »** ajoutée au `CatalogSeeder`.

### Tests
`Phase8SeminarTest` (5) : dérivation des passes (20000 / 30000 / 50000), passes personnalisés, désactivation → tiers supprimés, facture avec pass (prix résolu 30000, trace, total 60000), erreurs 422 (non séminaire, sans service, pass inexistant).

---

## 9. État global & déploiement local

- **Suite de tests** : 102 tests / **102 verts** (535 assertions) — `vendor\bin\phpunit` ; style : `vendor\bin\pint --dirty`.
- **Base locale** (PostgreSQL 16.14 Laragon, tâche planifiée `pekegno-postgres`) : toutes les migrations Ran (batches 5-8 pour les évolutions), seeders `PermissionSeeder`, `RoleSeeder`, `AccountingCategorySeeder`, `CatalogSeeder` ré-appliqués (vérifications : permissions `employes.*`, `bilans.*`, `abonnements.*`, `commercials.reporting` présentes ; catégorie « Séminaire » présente).

## 10. Piste restante (frontend, non commencé)

- Bug recherche : `Select` « Client » sur la liste des factures.
- Pages Employés (`/employees`), Historique des versements + modal d'encaissement (3 max), comptabilité (`/accounting`), Abonnements, Bilan du jour, **Reporting commerciaux** (filtres + export), formulaire service avec passes séminaire + `Select` « Pass » dans la vente.
- i18n fr/en de l'ensemble.