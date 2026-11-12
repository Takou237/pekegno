# Plan de travail — Corrections et clôture de la V1 Pekegno

> **Source de la demande** : `Plateforme Pekegno V1 — Corrections demandées à WORLDEV.docx`
> (document figé, 30 bugs B1–B30, 12 fonctions du CdC, 6 exigences de sécurité, checklist de réception).
> **Périmètre analysé** : dépôt complet `PEKEGNO` (backend Laravel + frontend React/Vite + frontend_client).
> **Date du plan** : 6 novembre 2026.
> **Statut** : plan de travail de référence — à valider par la Direction Pekegno et l'équipe WORLDEV.

---

## 0. Comment lire ce plan

| Élément | Signification |
|---|---|
| **P1** | Chiffre faux ou contrôle manquant → bloquant, à corriger en premier. |
| **P2** | Gêne l'usage quotidien. |
| **P3** | Confort / finition. |
| **Bxx** | Référence du bug dans le document du client (section 3). |
| **Txx.y** | Tâche numérotée du plan, rattachée à un lot. |
| **« Fait »** | Code livré **+** test automatisé vert **+** vérifié sur l'environnement de test (staging) **+** contrôle de réception coché. |

Chaque lot suit la même trame : objectif → tâches → fichiers touchés → tests → critères d'acceptation → dépendances → charge.

> **Règle d'or de ce plan** : on ne corrige pas les symptômes page par page. On construit **une seule source de vérité financière** (Lot 1) puis on y branche toutes les pages (Lot 4). Sans cela, les bugs B1/B2/B11/B12/B15/B17 réapparaîtront à chaque nouvel écran.

---

## 1. Résumé exécutif

### 1.1 Ce que demande le client

1. **Un seul calcul** du chiffre d'affaires, partout (aujourd'hui 5,4 M / 10,56 M / 11,6 M FCFA selon la page).
2. **Séparer les ventes de l'argent en caisse** : une agence peut vendre 500 000 avec 150 000 en espèces et 350 000 en mobile money ; la caisse physique ne contient que 150 000.
3. **Une entité Administration par pays**, distincte des agences.
4. **Sept rubriques de vente** au lieu de trois.
5. **La publicité de Pekegno** (campagne nationale répartie au prorata du CA, campagne locale rattachée à une agence).
6. **La correction de 30 bugs** (B1–B30), dont 16 en P1.
7. **Les fonctions du CdC V1 manquantes** (clôture de caisse, transferts, présences par séance, certificats vérifiables, contrats Agency, CRM, dépenses, primes, cockpit, notifications, import).
8. **La sécurité** (comptes nominatifs, 2FA, droits caissier, centre de sécurité, environnements séparés, sauvegardes/NDA).
9. **Un environnement de test** avec un compte par rôle.
10. **Une checklist de réception** de 18 points à valider avant livraison.

### 1.2 Ce qui existe déjà dans le code (à ne pas refaire)

Le socle est solide ; l'essentiel du travail est de **corriger la doctrine de calcul** et de **compléter les contrôles**.

| Brique existante | Fichier | État |
|---|---|---|
| Comptes de trésorerie + mouvements | `TreasuryAccount`, `TreasuryTransaction`, `TreasuryService` | Existe (types `cash`/`mobile_money`/`bank`, transfert atomique, contrepassation) |
| Bilan journalier / période / consolidé | `BilanService`, `BilanController` | Existe, mais calculs à revoir (B5, B6, B11, B12, B13) |
| Agrégats de CA | `RevenueService` | Existe, mais **définit le CA comme l'encaissé** → contradiction avec la section 1 du document |
| Comptabilité | `AccountingService`, `AccountingController`, `AccountingTransaction` | Existe (écritures income/expense, catégories système) |
| Dépenses (circuit) | `ExpenseService`, `ExpenseController` | Circuit demande → soumission → validation → paiement → clôture déjà présent |
| Contrats | `ContractService`, `ContractController`, statuts `draft/pending/active/due_soon/expired/suspended/terminated/renewed` | Existe, alerte de renouvellement à câbler |
| Certificats | `CertificateController`, `Certificate` | Existe côté interne, **pas de vérification publique** |
| CRM | `OpportunityController` + `OpportunityKanbanPage` | Pipeline Nouveau → Gagné/Perdu déjà présent, visibilité à vérifier |
| Présences | `AttendanceController`, `Attendance`, `AttendanceSheetPage` | Existe, mais « Présences » ouvre la page Sessions (B « présences par séance ») |
| 2FA | `TwoFactorService`, `TwoFactorController` | Existe (email), **non obligatoire par rôle** |
| Multi-devises | `GroupCurrency` (`countries.exchange_rate`), `Country.currency_code` | Existe |
| Fuseau métier | `config('app.business_timezone')`, `Period` | Existe, mais pas appliqué partout |
| Périmètre / permissions | `ScopeService`, `EnsurePermission`, `roles/permissions` | Existe |
| Sessions | `EnsureSingleSession`, `InactivityLogout`, `config/session.php` (120 min) | Existe, durée non modulée par rôle |

### 1.3 L'écart central à trancher

Le code actuel calcule **CA = encaissements validés** (`RevenueService`, commentaire explicite : « plus jamais le montant facturé »).
Le client demande **CA = total des factures validées de la période**, avec l'encaissé comme ligne distincte, et le contrôle :

```
Chiffre d'affaires = Encaissé sur les factures de la période + Impayés
```

**C'est la décision structurante du projet.** Elle impacte : tableaux de bord, bilans, rapports, exports, commissions (le client demande explicitement de **ne pas lancer le calcul des primes avant la correction de B1**).

---

## 2. État des lieux technique

### 2.1 Stack

- **Backend** : Laravel (PHP 8.3 en conteneur `pekegno-server`), Sanctum, PostgreSQL en local/production, SQLite en mémoire pour les tests (`phpunit.xml`).
- **Frontend** : React + TypeScript + Vite + Tailwind, react-i18next (`fr`/`en`), React Router (~200 routes).
- **Volume** : 187 migrations, ~95 contrôleurs, ~45 services métier, 77 fichiers de tests.
- **Doc existante** : `doc/A_FAIRE.md`, `doc/PLAN_EXECUTION.md`, `doc/audit.md`, `doc/deploy/` (procédures), `swagger.md`.

### 2.2 Chaîne de calcul actuelle (à remplacer)

```
Invoice (validation_status = validated, cancelled_at NULL)
   └── invoice_payments (paid_at)        → RevenueService::feeTotal / byAgency / byMode
   └── invoice_items (is_pass_through)   → déduction du budget pub client
AccountingTransaction (type = income)    → AccountingController
AccountingTransaction (type = expense)   → BilanService::expensesByCategory
DailyBalance (solde_initial/solde_final) → BilanService::openingBalance (écrit à la lecture !)
TreasuryTransaction (in/out)             → TreasuryAccount.computed_balance
```

Trois familles de montants coexistent donc : **facturé** (`invoices.total_amount`), **encaissé** (`invoice_payments.amount`), **comptable** (`accounting_transactions.amount`). D'où les écarts B1/B9/B12/B15.

### 2.3 Points de fuite identifiés dans le code

| # | Constat | Conséquence |
|---|---|---|
| F1 | `RevenueService` = encaissements, sans notion de CA facturé | CA faux vs CdC |
| F2 | `InvoicePayment` n'a **qu'une date** `paid_at`, pas de date de validation distincte | B11 impossible à corriger sans migration |
| F3 | `invoice_payments.treasury_account_id` est **nullable** et `PaymentService::resolveAccount` retombe silencieusement sur la caisse cash | B « compte trésorerie vide », caisses O/M mélangées |
| F4 | `TreasuryAccount` n'a pas de **code court** (C/O/M/B) ni de règle de visibilité par rôle | Section 2 inapplicable telle quelle |
| F5 | `BilanService::buildSingleDay` **écrit** `DailyBalance` à chaque lecture (GET non idempotent) | B6 (soldes qui changent sans correction) |
| F6 | `BilanService::openingBalance` (multi-agences) additionne des soldes stockés ou, à défaut, l'encaissé de la veille **sans les dépenses** | B6 |
| F7 | `Agency` n'a pas de type `administration` (`AgencyActivity::TYPES = ['agency','academy']`) | Section 2 impossible |
| F8 | `AcademyReportService::groupStats` : `potential_revenue = inscrits × prix × nb sessions` | B7 |
| F9 | `groupStats` charge les cours `agency_id NULL` dans un périmètre département | B23 |
| F10 | `StatsController::salesByCategory` joint la catégorie **via le service uniquement** et somme le **facturé** | B4 |
| F11 | `InvoiceController::index` exclut par défaut `cancelled_at` ; aucune colonne de statut de validation par défaut | B8 (factures « disparues ») |
| F12 | `Attendance` : taux = présents / pointages effectués, pas présents / attendus sur séances passées | B22 |
| F13 | `InactivityLogout` utilise `session.lifetime` global (120 min) | B26 |
| F14 | Aucune route publique de vérification de certificat | Fonction CdC manquante |
| F15 | Aucun environnement staging documenté/déployé | Section 5 |

---

## 3. Lot 0 — Cadrage et engagement (avant tout code)

**Objectif** : répondre au client point par point, figer les règles, éviter les allers-retours.

| Tâche | Contenu | Livrable |
|---|---|---|
| T0.1 | Répondre aux 30 bugs + 12 fonctions + 6 exigences sécurité avec « compris » / « question » / « hors V1 » + date de livraison | Tableau de réponse annexé au document client |
| T0.2 | Trancher la doctrine CA (section 1.3) et la faire confirmer par écrit | Décision écrite |
| T0.3 | Obtenir la liste des caisses Côte d'Ivoire (Orange Money, Wave, Moov…) | Liste validée |
| T0.4 | Obtenir le mapping exact des 7 rubriques (Academy, Agency, Canva, Livre, Matootoo, Séminaire, Budget pub client) vers les catégories existantes | Table de correspondance |
| T0.5 | Faire préciser la règle « Date échue » (B25) : automatique ou choisie par la caissière ? | Réponse écrite |
| T0.6 | Valider le périmètre Community Manager (scénario de test) | Périmètre écrit |
| T0.7 | Figer le jeu de données de recette : 31/10 → 03/11/2026 (factures, paiements, dépenses cités dans le document) | Jeu de données + dump |

**Charge : 2–3 j.** Aucun développement ne démarre avant T0.2 et T0.3.

---

## 4. Lot 1 — Socle financier unique (P1) — fondation de tout le reste

### 4.1 Objectif

Créer **un seul service** produisant les 7 indicateurs de la section 1, avec une seule définition par indicateur, une seule gestion des devises et des arrondis, et le contrôle `CA = Encaissé + Impayés`. Toutes les pages consomment ce service.

### 4.2 Contrat fonctionnel (à implémenter tel quel)

| Indicateur | Définition |
|---|---|
`ca` | Σ `invoices.total_amount` des factures **validées** de la période, non annulées, **hors pass-through** (budget pub client).
`encaisse` | Σ `invoice_payments.amount` **validés** dont la **date de réception** est dans la période, sur factures validées non annulées. Sous-ligne `dont_recouvrements` = part concernant des factures **antérieures** à la période.
`acomptes` | Σ paiements `is_advance = true` sur factures de la période **non soldées**.
`impayes` | Σ `total_amount - amount_paid` des factures validées de la période au statut `unpaid`/`partial`.
`depenses` | Σ sorties de la période **hors transferts** (versement banque, décaissement administratif, retrait).
`en_attente_validation` | Σ montants annoncés par les commerciaux (factures `validation_status = pending` + preuves de paiement en attente), non encore validés.
`net_caisse` | `encaisse − depenses`.
`panier_moyen` | `ca ÷ nombre de factures validées de la période`.
Contrôle | `ca = encaisse(factures de la période) + impayes` — assertion testée, pas seulement affichée.

**Arrondi** : au franc, sans centimes, **à l'affichage et dans les agrégats** (`round(x, 0)`), en conservant les décimales en base pour la réconciliation.
**Devise** : locale (XOF/XAF) dès qu'un pays/ville/agence est sélectionné ; conversion groupe via `countries.exchange_rate` sinon.
**Date d'un paiement** : date de **réception** (nouveau champ), pas date de validation.

### 4.3 Tâches

| # | Tâche | Fichiers |
|---|---|---|
| T1.1 | Créer `FinancialMetricsService` avec `summary(Carbon $from, Carbon $to, array $scope): array` et les 7 indicateurs + `byAgency`, `byMode`, `byCategory`, `byCommercial` | `app/Services/FinancialMetricsService.php` (nouveau) |
| T1.2 | Ajouter la notion de **période métier** unique (bornes UTC ↔ fuseau `Africa/Douala` / `Africa/Abidjan`) réutilisée par tous les écrans | `app/Support/Period.php` |
| T1.3 | Ajouter `received_at` (date de réception) et `validated_at` + `validation_status` sur `invoice_payments` ; backfill `received_at = paid_at` | migration `2026_11_xx_add_received_validated_at_to_invoice_payments` |
| T1.4 | Rendre `treasury_account_id` **obligatoire** sur les paiements et les dépenses (validation serveur, pas seulement UI) | `PaymentService`, `ExpenseService`, `StoreInvoiceRequest`/`PayInvoiceRequest` |
| T1.5 | Centraliser l'arrondi au franc (`Money::round`) et l'appliquer à tous les agrégats exposés | `app/Support/Money.php` (nouveau) + services |
| T1.6 | Ajouter au service la ventilation **par rubrique (7)** et **par branche** | `FinancialMetricsService` |
| T1.7 | Exposer un endpoint de synthèse unique `GET /api/metrics/summary` (filtres période/pays/ville/agence/département) | `MetricsController` (nouveau) + `routes/api.php` |
| T1.8 | Brancher `RevenueService` sur `FinancialMetricsService` (garder la classe comme façade pour ne pas casser les appels existants) | `RevenueService` |
| T1.9 | Écrire le test d'invariant `CA = Encaissé + Impayés` et le test « même CA partout » | `tests/Feature/FinancialMetricsConsistencyTest.php` |

### 4.4 Avancement Lot 1 (6/11/2026)

> Coches = implémentation + tests locaux verts, pas encore recette staging.

- [x] T0.2 — Décision écrite doctrine CA (`doc/DECISION_CA_T0.2.md`).
- [x] T1.1 — `FinancialMetricsService` (summary + byAgency/byMode/byCategory/byCommercial).
- [x] T1.2 — Période métier unique (`App\Support\Period`, déjà en place et réutilisée).
- [x] T1.3 — Migration `received_at` / `validated_at` / `validation_status` + backfill.
- [x] T1.4 — Caisse obligatoire sur chaque paiement **et chaque dépense** (7/11) : paiement → caisse déduite du mode, jamais nulle, sans repli sur C (`TreasuryAccountProvisioner`) ; dépense saisie en Comptabilité → caisse obligatoire + sortie de caisse synchronisée (création/modification/suppression). Mode « mobile » générique retiré de la saisie (ambigu O/M).
- [x] T1.5 — `App\Support\Money::franc()` adopté par le service unique et l'endpoint de synthèse.
- [x] T1.6 — Ventilation par rubrique (9/11) : une rubrique = une catégorie du catalogue (cf. T3.6), plus Formations et les catégories Agency.
- [x] T1.7 — `GET /api/metrics/summary` et `/api/metrics/breakdown`.
- [x] T1.8 — `RevenueService` transformé en façade de `FinancialMetricsService`.
- [x] T1.9 — `tests/Feature/FinancialMetricsConsistencyTest.php` (invariant + cas limites + même CA partout).

### 4.5 Critères d'acceptation

- Sur le jeu de recette 31/10 → 03/11, les 5 écrans (Tableau de bord, Pays, Comparaison CA, Rapport clients, Comptabilité) renvoient **exactement** le même `ca`.
- Aucun montant avec centimes dans aucune réponse API de synthèse.
- Le test d'invariant passe sur des cas limites : facture partielle, acompte, facture annulée, facture rejetée, paiement sur facture antérieure.

**Charge : 8–10 j.** Dépend de T0.2.

---

## 5. Lot 2 — Caisses, trésorerie et clôture (P1)

### 5.1 Objectif

Séparer **ventes** et **argent par caisse**, rendre la caisse obligatoire, bloquer la visibilité des caisses O/M/B côté serveur, et livrer la clôture journalière avec écart justifié.

### 5.2 Modèle cible

| Caisse | Type | Contenu | Qui la voit |
|---|---|---|---|
`C` | `cash` | Espèces (caisse physique de l'agence) | Caissière, équipe agence, administration, DG |
`O` | `mobile_money` (provider `orange_money`) | Orange Money | Administration + DG |
`M` | `mobile_money` (provider `mtn_momo`) | MTN MoMo | Administration + DG |
`B` | `bank` | Banque | Administration + DG |

Côte d'Ivoire : liste à confirmer (T0.3) — prévoir `wave`, `moov_money`.

### 5.3 Tâches

| # | Tâche | Fichiers |
|---|---|---|
| T2.1 | Ajouter `code` (C/O/M/B…) unique par agence + `visible_roles` sur `treasury_accounts` | migration `add_code_and_visibility_to_treasury_accounts` |
| T2.2 | Seed par pays : une caisse C/O/M/B par agence + caisses Administration | `database/seeders/TreasuryAccountsSeeder.php` |
| T2.3 | `TreasuryPolicy` : interdire la lecture des comptes O/M/B à tout rôle non Administration/DG, **côté serveur** (Sécu §16) | `app/Policies/TreasuryPolicy.php` (nouveau) |
| T2.4 | Exposer les comptes filtrés par rôle dans `GET /treasury/accounts` et masquer les soldes | `TreasuryController` |
| T2.5 | Ventilation `invoice_payments` → caisse par `payment_method` (C/O/M/B), avec `treasury_account_id` obligatoire | `PaymentService` |
| T2.6 | Ajouter `transfer_type` (`bank_deposit`, `admin_disbursement`, `withdrawal`, `internal`) et exclure les transferts de `depenses` | migration + `TreasuryService` |
| T2.7 | Écrire les transferts dans la comptabilité **hors charges** (comptes de virement, jamais `type = expense`) | `TreasuryService`, `AccountingService` |
| T2.8 | Créer la **clôture journalière** : `cash_closings` (date, caisse, solde théorique, solde réel, écart, justification, clôturé par, validé par) | migration + `CashClosingController` + `CashClosingService` |
| T2.9 | Interdire deux clôtures pour la même caisse/jour ; calculer `solde_théorique = solde_initial + entrées − sorties ± transferts` | `CashClosingService` |
| T2.10 | Écart ≠ 0 → justification obligatoire + alerte au chef d'agence | `CashClosingService`, `AgencyAlertService` |
| T2.11 | Écran « Caisses du jour » (soldes C/O/M/B, entrées/sorties/transferts, clôture) | `frontend/src/pages/treasury/CashClosingsPage.tsx` (nouveau) |
| T2.12 | Le Bilan utilise les comptes de trésorerie, pas un seau unique | `BilanService` |

### 5.4 Critères d'acceptation

- Douala 02/11 : C = **381 000** avant décaissement administratif, **131 000** après ; O et M séparés ; total ventes = 500 000 ≠ caisse C.
- Une caissière reçoit **403** sur `GET /treasury/accounts` des caisses O/M/B.
- Un versement en banque apparaît en **transfert**, jamais en dépense (B13).
- Une clôture sans écart ne demande pas de justification ; avec écart, le bouton reste bloqué sans motif.

**Charge : 12–15 j.** Dépend de T1.4.

### 5.5 Avancement Lot 2 (7/11/2026)

> Coches = implémentation + tests locaux verts, pas encore recette staging.

- [x] T2.1 - Migration `code` (unique par agence) + `visible_roles` + backfill canonique C/B/O/M/W/V.
- [x] T2.2 - `TreasuryAccountSeeder` idempotent (codes, Wave/Moov en XOF, caisses O/M/B restreintes).
- [x] T2.3 - `TreasuryPolicy` (`view`/`transfer`) enregistrée dans `AppServiceProvider`.
- [x] T2.4 - `GET /treasury/accounts`, `/treasury/transactions` et transferts filtrés par rôle (403 hors périmètre).
- [x] T2.5 - Ventilation méthode → caisse (C/O/M/B/W/V) obligatoire (7/11). Mouvement de caisse et écriture de recette datés de la **réception** (B11) ; validation d'une preuve = date de dépôt de la preuve. Annulation d'une facture = sortie de caisse compensatoire. Rattrapage : `php artisan treasury:backfill-payments` (simulation, puis `--apply`, après `invoices:reverse-cancelled-payments --apply`). Tests : `PaymentTreasuryRoutingTest` 12/12.
- [x] T2.6 - `transfer_type` (`bank_deposit`, `admin_disbursement`, `withdrawal`, `internal`) + validation API + UI.
- [x] T2.7 - Colonne `accounting_transactions.is_transfer` (sans toucher l'enum) : un transfert n'est jamais compté en dépense (service financier, Bilan, Stats, Comptabilité, agences). Saisie d'un « versement bancaire » en dépense refusée (422). Rattrapage : `php artisan treasury:reclassify-transfers` (simulation puis `--apply`).
- [x] T2.8 - Table `cash_closings` + `CashClosingController` + `CashClosingService`.
- [x] T2.9 - Unicité caisse/jour + `solde_théorique = solde initial + entrées − sorties`, journée en **heure locale** de l'agence (Douala UTC+1, Abidjan UTC+0).
- [x] T2.10 - Écart non nul → justification obligatoire (422) + notification au chef d'agence ; validation réservée au chef d'agence / à la direction, jamais à l'auteur de la clôture.
- [x] T2.11 - `frontend/src/pages/treasury/CashClosingsPage.tsx` + route `/treasury/closings` + menu.
- [x] T2.12 - `BilanService` expose `treasury_accounts` (solde par caisse) et `total_treasury`.

Tests (7/11) : `TreasuryCashClosingTest` 8/8, `PaymentTreasuryRoutingTest` 12/12, `TreasuryControlsTest` 9/9 ; suite complète locale 598 verts / 37 échecs préexistants documentés dans `CLAUDE.md` (31 = extension GD absente de l'image Docker locale).

---

## 6. Lot 3 — Administration par pays, rubriques, publicité (P1)

### 6.1 Tâches

| # | Tâche | Fichiers |
|---|---|---|
| T3.1 | Ajouter le type `administration` : nouvelle valeur dans `AgencyActivity::TYPES` **ou** entité `Administrations` — décision à valider ; recommandation : réutiliser `agencies` avec `type = administration` pour conserver factures/dépenses/périmètre | migration + `Agency` |
| T3.2 | Créer une Administration par pays (Cameroun, Côte d'Ivoire) + caisses propres + dépenses propres | seeder + migration de données |
| T3.3 | Rapatrier les dépenses d'administration saisies sur Douala (frais admin, pub Pekegno, stock livres/Matootoo) | commande de migration de données + journal d'anomalies |
| T3.4 | Vue Pays : deux corps (Agences / Administration) + total | `StatsController::country`, `CountryDashboardPage` |
| T3.5 | Bilan du jour : ventes de l'agence d'un côté, caisses de l'autre | `BilanService`, `DailyBilanPage` |
| T3.6 | Modéliser les **7 rubriques** (`sale_rubrics`) et rattacher services/produits/formations | migration + seeder |
| T3.7 | Bilan et rapports : colonnes par rubrique (7), plus seulement Formations/Prestations/Store | `BilanService`, `AcademyReportService`, front |
| T3.8 | **Publicité Pekegno** : dépense unique, champs `branche` (Academy/Agency/Store/Studio), `pays`, `ville` cible, `national` boolean | migration `ad_campaigns` |
| T3.9 | Campagne locale → imputée à l'agence de la ville | `AdCampaignService` |
| T3.10 | Campagne nationale → répartition mensuelle au prorata du CA de la branche par agence | `AdCampaignService` + commande mensuelle |
| T3.11 | Résultat par agence sur 2 lignes : « avant pub » / « après pub » | `AgencyReportService`, `AgencyReportPage` |
| T3.12 | **Budget pub client** : encaissement et dépense appariés, exclus du CA et des dépenses, seuls les honoraires comptent | `FinancialMetricsService` (pass-through déjà partiellement géré) |
| T3.13 | **Ventes inter-agences** : compter pour l'agence d'encaissement **et** pour le commercial ; jamais deux fois au groupe | `SaleAgencyResolver`, `CommercialReportService`, tests `InterAgencySaleTest` |
| T3.14 | **Dépense rattachée à un événement** (`event_id`) pour calcul de rentabilité | migration + `ExpenseService` + écran rentabilité événement |

### 6.2 Critères d'acceptation

- Le Cameroun affiche deux corps distincts et leur total.
- Une pub nationale Academy de test est répartie entre Douala et Yaoundé au prorata de leur CA Academy du mois.
- Une vente d'Abidjan encaissée à Douala compte **une seule fois** au groupe, pour Douala et pour la commerciale (B16).
- Les 7 rubriques apparaissent dans le Bilan.

**Charge : 15–18 j.** Dépend de T0.3, T0.4 et du Lot 1.

### 6.3 Avancement Lot 3 (9/11/2026)

> Lot entamé : les tâches qui ne dépendent pas d'une réponse du client sont faites (branche `corrections`).

- [ ] T3.1 – T3.4 — Administration par pays : **attend la décision du client**.
- [x] T3.5 — Bilan du jour : ventes d'un côté, caisses de l'autre (tableau par caisse : solde initial, entrées, sorties, solde final, compté, écart).
- [x] T3.6 — Rubriques : **décision du 9/11 — une rubrique = une catégorie du catalogue**, pas de liste figée de 7 ni de table `sale_rubrics`. Tout article créé par « Créer un service » (ou produit) relève de la branche **Store**, quelle que soit sa catégorie ; sa catégorie (Livre, Canva…) est sa rubrique. Créer une catégorie crée la rubrique. Rubriques fixes : **Academy** (inscriptions), **Agency** (packages, prestations) et **Séminaire** (tout service coché « Service séminaire (Pass) », prioritaire sur sa catégorie). Pas de rubrique « Store » : chaque catégorie Store est déjà sa propre rubrique. Règle unique : `App\Support\SaleBranch`.
- [x] T3.7 — Colonnes par rubrique : Bilan du jour (une colonne par catégorie, service ou produit confondus, même à zéro) et Comptabilité (« Recettes par rubrique », chaque versement réparti sur les lignes de sa facture). Autres rapports (`AcademyReportService`…) : à suivre.
- [ ] T3.8 – T3.11 — Publicité Pekegno (campagnes locales / nationales, résultat avant / après pub).
- [x] T3.12 — Budget pub client : exclu du CA et de l'encaissé, **et de la dépense** (décision du 12/11). Une dépense peut être rattachée à la facture qui la finance (`expenses.invoice_id`) : elle est alors marquée `is_pass_through`, son écriture comptable aussi, et sort des dépenses d'exploitation (Bilan, Comptabilité, synthèses, rapport agence). Le rapport Agency affiche désormais budget encaissé / dépensé / solde. Test `PassThroughBudgetTest`.
- [x] T3.13 — Ventes inter-agences : CA dans l'agence de la facture et pour le commercial, une seule fois au groupe (test `CorrectionsP1Test`).
- [x] T3.14 — Dépense rattachée à un événement : **décision du 12/11 — l'événement est le séminaire vendu au catalogue** (pas d'entité séparée). `expenses.service_id`, écran « Rentabilité des événements » (`GET /api/reports/events`) : ventes de la période − dépenses rattachées = marge et taux de marge. Test `EventProfitabilityTest`.

Test : `CorrectionsP1Test::test_rubrics_are_academy_agency_seminar_and_each_catalog_category`.

---

## 7. Lot 4 — Bugs P1 (B1 à B16)

> Chaque ligne : cause racine identifiée dans le code → correctif → test.

| Réf | Cause racine | Correctif | Fichiers | Test |
|---|---|---|---|---|
| **B1** | Trois définitions du CA : `RevenueService` (encaissé), `StatsController::overview` (net encaissé), `ReportController`/`AccountingController` (facturé/comptable) | Brancher tout sur `FinancialMetricsService` | `RevenueService`, `StatsController`, `ReportController`, `AccountingController`, `ExportController`, `DashboardController` | `FinancialMetricsConsistencyTest` |
| **B2** | Cartes absentes ou mal libellées ; `overview()` renvoie `revenue` (= encaissé) sans les 7 cartes | Exposer les 7 cartes + composant `KpiCards` partagé sur Groupe/Pays/Agence/Département | `StatsController`, `DashboardController`, `CountryDashboardPage`, `PEKEGNOGroupDashboard`, `CashierDashboardPage`, `AgencyDeptDashboardPage`, i18n | `DashboardCardsTest` |
| **B3** | Tableau de bord « Hier » filtre sur des bornes UTC et une requête différente de la liste | Utiliser `Period` + bornes métier + **même requête** que `InvoiceController::index` | `DashboardController`, `Period` | `DashboardMatchesInvoiceListTest` (10 factures, 2 Yaoundé) |
| **B4** | `salesByCategory` catégorise via `services.category_id` seulement et somme `line_total` | Catégorie depuis la ligne de facture (`invoice_items.category_id`, repli service), montant **encaissé** ; backfill lignes sans catégorie | `StatsController`, migration backfill, `FinancialMetricsService` | `SalesByCategoryTest` (« Sans catégorie » ≤ total facturé) |
| **B5** | Aucun calcul « total période » : le front additionne les lignes | Ajouter `period_totals` = 1er solde initial / dernier solde final, entrées et sorties cumulées | `BilanService::period`, `BilanController`, `DailyBilanPage` | `BilanPeriodTotalsTest` |
| **B6** | `openingBalance` consolidé = somme de soldes stockés ou encaissé de la veille sans dépenses ; écriture en base à la lecture | Recalculer le solde initial = Σ soldes finaux de la veille **par agence**, rendre le GET pur (écriture déplacée dans une commande), invalider les soldes si un paiement passé change | `BilanService` | `BilanOpeningBalanceTest` (1 403 762 → 1 586 262 attendu) |
| **B7** | `potential_revenue = enrolled × price × sessions` | Remplacer par Σ prix des inscriptions actives (au plus le total réellement souscrit) | `AcademyReportService::groupStats` | `AcademyPotentialRevenueTest` (CRS-00001 ≤ 6 615 000) |
| **B8** | Filtres par défaut excluant les factures rejetées/annulées ; aucune trace dans le journal | Liste par défaut = **toutes** les factures non annulées, colonne de statut, action « annuler » avec motif journalisé ; jamais de suppression | `InvoiceController::index`, `ActivityLogger`, `InvoiceListPage`/`AcademyInvoicesPage` | `InvoiceAlwaysVisibleTest` (PK-20261101-009 visible) |
| **B9** | Paiements de factures annulées restent dans `accounting_transactions` | Annulation en cascade : paiements annulés + contrepassation comptable + mouvements de trésorerie annulés, dans une transaction DB | `InvoiceController::cancel`, `PaymentService`, `AccountingService`, `TreasuryService` | `InvoiceCancellationCascadeTest` |
| **B10** | `AccountingController::index` limite à 15 sans pagination | Pagination complète + totaux calculés sur **toute** la requête, pas la page | `AccountingController`, `AccountingPage` | `AccountingPaginationTest` (Douala 02/11 : 680 000) |
| **B11** | Une seule date `paid_at` = date de validation | Ajouter `received_at` (réception) et `validated_at` (validation) ; Bilan et rapports utilisent `received_at` | migration, `PaymentService`, `PaymentProofController`, `BilanService` | `PaymentReceivedDateTest` (Yaoundé 02/11 → 02/11) |
| **B12** | Bilan (encaissé) vs Comptabilité (écritures income) divergent | Brancher les deux sur `FinancialMetricsService` | `BilanService`, `AccountingController` | `BilanEqualsAccountingTest` (550 000 = 550 000) |
| **B13** | Versement banque enregistré en dépense | Type de transfert dédié, exclu de `depenses`, visible en trésorerie | `TreasuryService`, `ExpenseService`, `AccountingService` | `BankDepositIsTransferTest` (Cameroun : 89 000 de vraies dépenses) |
| **B14** | « FCFA » codé en dur ; XOF et XAF additionnés | Formater par devise (`formatCurrency(amount, currency)`), conversion groupe via `GroupCurrency`, mention explicite XOF/XAF | `frontend/src/utils/format`, `GroupCurrency`, toutes les pages montants | `CurrencyFormattingTest` |
| **B15** | Taux de recouvrement calculé sur une autre base que la carte Encaissé | Une seule source : `encaisse` du service | `DashboardController`, `PEKEGNOGroupDashboard` | `RecoveryRateConsistencyTest` (61,74 % recalculé) |
| **B16** | CA commercial rattaché à l'agence du **profil** | Rattacher au `invoices.agency_id` (agence d'encaissement) et au commercial de la facture | `CommercialReportService`, `SalesTrackingController`, `CommercialController::stats` | `InterAgencySaleTest` (déjà présent) + `CommercialAgencyRevenueTest` |

### 7.1 Avancement Lot 4 (9/11/2026)

- [ ] B1 — En partie : même CA sur 6 écrans (test) ; Comptabilité (registre d'écritures) à rapprocher.
- [ ] B2 — En partie : cartes sur les tableaux de bord groupe / pays / agence / département ; clic sur carte à faire.
- [ ] B3 — En partie : requête commune `InvoiceListQuery` (Takou237, 8/11) ; test à écrire.
- [x] B4 — Catégorie de chaque ligne (`SaleBranch`), total des catégories = CA ; chaque écriture de versement prend la catégorie de sa rubrique (9/11). Rattrapages `accounting:reassign-departments` et `accounting:categorize-income`.
- [x] B5 — Total période = premier solde initial / dernier solde final.
- [x] B6 — Soldes tirés des caisses, consolidé = somme des soldes finaux de la veille, aucune écriture à la lecture.
- [x] B7 — Revenus potentiels = somme des inscriptions.
- [x] B8 — Filtre « Annulée » réparé, facture retirée par le client annulée (jamais supprimée), annulation via inscription journalisée. Reste : champ « motif » à l'écran.
- [x] B9 — Annulation en cascade ; rattrapage `invoices:reverse-cancelled-payments`.
- [x] B10 — Comptabilité paginée, totaux sur toute la période.
- [x] B11 — Date de réception (Bilan, caisses, Comptabilité) ; rattrapage `treasury:backfill-payments`.
- [x] B12 — Conséquence de B9 et B11.
- [x] B13 — Transferts typés, jamais en dépense ; rattrapage `treasury:reclassify-transfers`.
- [x] B14 — Conversion en monnaie du groupe en vue multi-pays (Bilan, Suivi des ventes), devise affichée ; bouton de devise sur PEKEGNO Group.
- [x] B15 — Taux de recouvrement = encaissé sur les factures de la période ÷ CA, base affichée.
- [x] B16 — CA du commercial dans l'agence de la facture.

Tests : `CorrectionsP1Test`, `BilanTreasuryAndLedgerTest`, `FinancialMetricsConsistencyTest`… ; suite complète 626 verts / 37 échecs connus. Livraison : `doc/deploy/08_11/`.

---

## 8. Lot 5 — Bugs P2 (B17 à B26)

| Réf | Cause racine | Correctif | Fichiers | Test |
|---|---|---|---|---|
| **B17** | Panier moyen = CA ÷ 3 (mauvais dénominateur) | `panier_moyen = ca ÷ nb factures validées` | `FinancialMetricsService` | `AverageBasketTest` (~117 000) |
| **B18** | Montants décimaux laissés tels quels | Arrondi au franc partout (API + affichage) | `Money`, services, front | `RoundingTest` |
| **B19** | `PaymentProofController::index` ne renvoie pas le client/montant annoncé de façon exploitable | Exposer `client_name` (facture/client) + `amount` (preuve, repli total facture) ; corriger les colonnes UI | `PaymentProofController`, `PaymentProofsPage` | `PaymentProofColumnsTest` |
| **B20** | Statuts de session/contrat non recalculés | Statut de session **calculé** depuis les dates (planifiée/en cours/terminée) ; commande `contracts:refresh-status` planifiée + calcul à la lecture | `TrainingSession` (accessor), `ContractService`, `routes/console.php` | `StatusAutoRefreshTest` (CRS-00004, CTR-00014, CTR-00004/12) |
| **B21** | « Abonnements actifs » compte les `subscriptions` et non les contrats | Compter les contrats `active` + `due_soon` | `DashboardController`, `SubscriptionsReportPage`/carte | `ActiveContractsCardTest` (8) |
| **B22** | Taux = présents / pointages effectués | Taux = présents / attendus sur les séances **passées**, même formule dans les 3 écrans | `AcademyReportService`, `AcademyReportService::groupServices`, `AgencyReportService` | `AttendanceRateConsistencyTest` |
| **B23** | Cours `agency_id NULL` inclus dans le périmètre département | Filtrer strictement sur les agences du département ; exclure les cours globaux non déployés | `AcademyReportService::groupStats` | `DepartmentAcademyScopeTest` (14 / 11) |
| **B24** | Branche du livre incohérente entre deux pages | Champ `branch` unique sur `products`/`services`, source unique pour Suivi des ventes et Store | migration + `Product`, `CatalogRevenueService` | `ProductBranchTest` |
| **B25** | Motif « Date échue » non traçable (aucune occurrence dans le code) | Documenter la règle après T0.5 ; si automatique, la rendre visible (badge + explication) et journalisée ; si manuelle, la proposer dans une liste de motifs | `PaymentProofController`, i18n, `PaymentProofsPage` | `PaymentProofRejectionReasonTest` |
| **B26** | `session.lifetime` global 120 min, y compris DG | Durée par rôle (`config/auth.php` ou `settings.session_lifetime_minutes`) : DG 12 h, autres 2 h ; rafraîchir `last_activity_at` | `config/session.php`, `InactivityLogout`, `Setting` | `SessionLifetimeByRoleTest` |

---

## 9. Lot 6 — Bugs P3 (B27 à B30)

| Réf | Cause racine | Correctif | Fichiers |
|---|---|---|---|
| **B27** | `ReportController::customers` ne remplit pas les classements pays/ville | Agréger par pays et par ville et renvoyer les deux listes | `ReportController`, `CustomersReportPage` |
| **B28** | Libellés de filtre construits sans nom d'agence ; libellé générique du Journal | « Academy — Douala » ; « Tous les utilisateurs » | `ReportFilters`, `ActivityLogPage`, `AgencyDepartmentController` |
| **B29** | Bornes « cette année » calculées en UTC, écran au 04/11 alors que 03/11 | Utiliser le fuseau métier par pays (UTC+1 Cameroun, UTC+0 Côte d'Ivoire) | `Period`, `ComparisonReportPage` |
| **B30** | `ProspectController::scopeByRole` renvoie « aucun prospect » pour la DG dans certains cas | La DG voit tous les prospects ; filtre commercial facultatif | `ProspectController::scopeByRole` |

---

## 10. Lot 7 — Fonctions du cahier des charges V1 manquantes

| Fonction (réf.) | État | Travail à faire | Charge |
|---|---|---|---|
| **Clôture de caisse journalière** (MVP §9/§12) | Absente | Voir T2.8–T2.11 : saisie du solde réel, écart, justification, alerte chef d'agence | 4 j (dans Lot 2) |
| **Transferts** (MVP §21, CdC §19) | `TreasuryService::transfer` existe, non exposé métier | Types métier, UI, exclusion des dépenses, comptabilité | 3 j |
| **Comptes de trésorerie obligatoires** (CdC §12) | Colonne vide | T1.4 + T2.5 + contrôle UI bloquant | 2 j |
| **Entité Administration** (CdC §3) | Absente | Lot 3 | 6 j |
| **Présences par séance** (MVP §10, CdC §7) | Lien vers Sessions ; planning = date de début | Modèle `session_sessions` (séance datée) + appel par séance + écran formateur ; le lien « Présences » doit ouvrir les séances | 8 j |
| **Certificats vérifiables** (MVP §10) | Interne seulement | Numéro de série unique + `GET /api/public/certificates/{serial}/verify` + page publique de vérification | 4 j |
| **Contrats Agency** (MVP §11) | Pas de circuit de validation ni alerte | Contrat `pending` → validation caissière → `active` ; alerte avant échéance (commande + notification) | 4 j |
| **CRM** (MVP §4, CdC §6) | Pipeline existant | Vérifier visibilité/menus/permissions, relances (activités planifiées), conversion prospect → client | 3 j |
| **Dépenses** (CdC §14) | Circuit présent | Rendre le circuit visible (stepper), justificatif photo obligatoire, décaissement tracé | 2 j |
| **Moteur de primes** (MVP §6) | Règles paramétrées | Afficher le **versionnement** ; **ne pas lancer** octobre avant B1 | 2 j |
| **Cockpit par employé** (MVP §7) | Non vérifiable | Démonstration par rôle sur staging + écran cockpit | 3 j |
| **Notifications** (MVP §12) | Cloche présente | Déclencheurs : créance échue, renouvellement, écart de caisse (tests + démo) | 3 j |
| **Import historique** (MVP §4, CdC §21) | Octobre peu fiable | Journal d'import + liste des anomalies + reprise des centimes (B18) | 5 j |

**Total Lot 7 : ~49 j** (dont ~9 déjà comptés dans les Lots 1–2).

---

## 11. Lot 8 — Contrôles de saisie

| # | Contrôle | Mise en œuvre | Test |
|---|---|---|---|
| T8.1 | Commercial **et** catégorie obligatoires sur chaque facture | `StoreInvoiceRequest`, validation 422 | `InvoiceRequiredFieldsTest` |
| T8.2 | Alerte doublon : même client, même montant, < 7 jours | Service `DuplicateInvoiceDetector` + avertissement non bloquant | `InvoiceDuplicateWarningTest` |
| T8.3 | Alerte client existant (nom ou téléphone) | `ClientController::store` → 409 + suggestion | `ClientDuplicateWarningTest` |
| T8.4 | Format email et téléphone | Form Requests (regex par pays) | `ClientContactValidationTest` |
| T8.5 | Formateur obligatoire pour créer une session | `StoreTrainingSessionRequest` | `SessionRequiresTrainerTest` |

---

## 12. Lot 9 — Sécurité (P1)

| Exigence | Constat code | Travail | Fichiers |
|---|---|---|---|
| Comptes nominatifs | Risque de comptes partagés en base (`Admin PEKEGNO`, `Admin2`, `Caissier Provisoire Yde`) | Audit des comptes, désactivation, interdiction de comptes génériques, rapport d'audit | commande `security:audit-accounts`, `UserController` |
| Double authentification | `TwoFactorService` existe, non imposée | Rendre obligatoire pour super-admin, DG, comptable, caissières ; écran d'activation forcée | `TwoFactorService`, `TwoFactorPage`, `routes/api.php` |
| Droits du rôle Caissier | 5/5 en Comptabilité, 4/4 catégories | Revoir la matrice avec le client ; restriction par défaut au périmètre agence | seeder permissions, `RoleController` |
| Centre de sécurité Super Admin | Absent | Écran : sessions actives, comptes privilégiés, accès développeurs, exports | `SecurityCenterController` + page |
| Environnements séparés | Aucun staging | Voir Lot 10 | `render.yaml`, `doc/deploy` |
| Sauvegardes / export / code / NDA | Non visible | Preuves écrites : test de restauration daté, accès dépôt + hébergement, NDA signé | documentation |

---

## 13. Lot 10 — Environnement de test et exploitation

| # | Tâche | Détail |
|---|---|---|
| T10.1 | Déployer `staging.pekegnogroup.com` | Copie de la production + base anonymisée |
| T10.2 | Créer **un compte de test par rôle** | Caissier, Commercial, Formateur, Community Manager, Responsable Agence, Responsable Département, Comptable, DG |
| T10.3 | Fermer l'accès développeur à la production par défaut + journaliser | Middleware + `ActivityLogger` |
| T10.4 | Procédure de restauration testée et datée | `doc/deploy/RESTAURATION.md` |
| T10.5 | Accès Pekegno au dépôt de code et à l'hébergement | Documentation des accès |
| T10.6 | NDA signé | Document |

---

## 14. Lot 11 — Tests, recette et réception

### 14.1 Tests automatisés à créer

| Test | Couvre |
|---|---|
| `FinancialMetricsConsistencyTest` | B1, B2, B15 |
| `BilanPeriodTotalsTest` | B5 |
| `BilanOpeningBalanceTest` | B6 |
| `BilanEqualsAccountingTest` | B12 |
| `BankDepositIsTransferTest` | B13 |
| `CashClosingTest` | Clôture, écart, justification |
| `TreasuryVisibilityTest` | Caissière ≠ O/M/B (Sécu §16) |
| `AcademyPotentialRevenueTest` | B7 |
| `InvoiceAlwaysVisibleTest` | B8 |
| `InvoiceCancellationCascadeTest` | B9 |
| `AccountingPaginationTest` | B10 |
| `PaymentReceivedDateTest` | B11 |
| `PaymentProofColumnsTest` | B19 |
| `StatusAutoRefreshTest` | B20 |
| `AttendanceRateConsistencyTest` | B22 |
| `DepartmentAcademyScopeTest` | B23 |
| `SessionLifetimeByRoleTest` | B26 |
| `PublicCertificateVerificationTest` | Certificats |
| `AdCampaignAllocationTest` | Pub nationale |
| `AdminEntityTest` | Administration par pays |

**Convention** : tests Feature Laravel (SQLite mémoire), jeu de données de recette partagé via un seeder `RecetteDatasetSeeder` reproduisant les chiffres du document (31/10 → 03/11/2026).

> **Échecs connus à ne pas confondre avec une régression** (CLAUDE.md) : ~31 tests `GD extension is not installed` (image Docker locale), 5 tests de preuve de paiement obligatoire pour `responsable-agence`, 1 test `ClientPackageSubscriptionTest` (avance plafonnée). Vérifier que **la liste ne change pas** avant/après chaque lot.

### 14.2 Checklist de réception (18 points du client — à cocher en staging puis en production)

- [ ] CA 2026 identique sur Tableau de bord, Pays, Comparaison CA, Rapport clients, Comptabilité (B1).
- [ ] Chaque tableau de bord commence par les cartes de la section 1 (B2).
- [ ] 02/11 : 10 factures, dont 2 à Yaoundé (B3).
- [ ] « Sans catégorie » ≤ total facturé (B4).
- [ ] Soldes du Bilan consolidé justes, jour par jour et en total période (B5, B6).
- [ ] Revenus potentiels CRS-00001 ≤ 6 615 000 (B7).
- [ ] PK-20261101-009 visible avec son statut (B8).
- [ ] Montants d'Abidjan en XOF et convertis dans les totaux groupe (B14).
- [ ] Caisse C de Douala au 02/11 : 381 000 puis 131 000 ; O et M séparées.
- [ ] Versement en banque = transfert, pas dépense (B13).
- [ ] Caissière ne voit pas les soldes O/M/B.
- [ ] Pub nationale Academy répartie au prorata du CA Academy.
- [ ] Vente inter-agences comptée une fois, pour Douala et pour la commerciale (B16).
- [ ] Un formateur peut faire l'appel d'une séance.
- [ ] Comptes partagés supprimés ; 2FA active.
- [ ] Chaque rôle déroule son scénario sans erreur.
- [ ] Bugs P2 et P3 corrigés ou datés.
- [ ] Environnement de test opérationnel avec un compte par rôle.

### 14.3 Scénarios par rôle (staging)

| Rôle | Scénario |
|---|---|
| Caissier | Valider puis rejeter une preuve ; paiement partiel sur ancienne facture ; clôture de la caisse C. |
| Commercial | Créer un prospect, le convertir, facturer avec avance ; ne voir que ses clients. |
| Formateur | Voir ses sessions, faire l'appel ; ne voir ni montants ni autres agences. |
| Community Manager | Périmètre défini (T0.6) puis testé. |
| Responsable Agence | Voir/valider son agence uniquement ; saisir une dépense. |
| Responsable Département | Créer une session avec formateur ; ne voir que sa branche. |
| Comptable | Saisir une dépense Administration ; exporter un mois. |
| Direction générale | Voir caisses O/M/B ; mêmes totaux partout. |

---

## 15. Planning proposé

Hypothèse : 1 développeur backend + 1 développeur frontend + 1 QA à mi-temps.

| Semaine | Contenu | Livrable |
|---|---|---|
| S1 | Lot 0 (cadrage), T1.1–T1.4 | Doctrine validée, service financier + migrations |
| S2 | T1.5–T1.9, début Lot 2 (T2.1–T2.5) | CA unique, caisses codifiées |
| S3 | Lot 2 (clôture, transferts, visibilité) | Caisses + clôture livrées |
| S4 | Lot 3 (Administration, rubriques) | Entité Administration + 7 rubriques |
| S5 | Lot 3 (publicité, inter-agences) | Pub nationale, 2 lignes avant/après |
| S6 | Lot 4 (B1–B8) | Bugs P1 première moitié |
| S7 | Lot 4 (B9–B16) | Bugs P1 terminés |
| S8 | Lot 5 (B17–B26) | Bugs P2 |
| S9 | Lot 6 + Lot 8 | Bugs P3 + contrôles de saisie |
| S10 | Lot 7 (séances, certificats, contrats) | Fonctions CdC principales |
| S11 | Lot 7 (reste) + Lot 9 | Notifications, cockpit, sécurité |
| S12 | Lot 10 + Lot 11 | Staging, recette, checklist |

**Charge totale estimée : 65–80 jours-homme.**

---

## 16. Risques et points à trancher

| Risque | Impact | Mitigation |
|---|---|---|
| Changement de doctrine CA (facturé vs encaissé) | Tous les écrans et les commissions | Décision écrite T0.2 ; gel du calcul des primes jusqu'à B1 |
| Caisses Côte d'Ivoire non confirmées | Modèle de caisses incomplet | Prévoir `provider` extensible, seed paramétrable |
| Données historiques d'octobre non fiables | Recette impossible sur chiffres réels | `RecetteDatasetSeeder` reproduisant les montants du document |
| Factures rejetées/annulées déjà perdues en base | B8 non démontrable | Audit SQL des factures orphelines + script de récupération |
| Multi-devises | Sommes fausses si un écran oublie la conversion | Une seule porte de sortie (`FinancialMetricsService`) + test de non-régression |
| Paiements sans compte de trésorerie existants | Blocage après T1.4 | Migration de rattachement automatique à la caisse C + rapport d'anomalies |

**Points à trancher avec le client** : doctrine CA (T0.2) ; liste des caisses CI (T0.3) ; mapping des 7 rubriques (T0.4) ; règle « Date échue » (T0.5) ; périmètre Community Manager (T0.6) ; comportement de la catégorie de paiement pour une facture multi-lignes.

---

## 17. Annexes

### 17.1 Fichiers backend principalement concernés

```
app/Services/FinancialMetricsService.php        (nouveau)
app/Services/RevenueService.php
app/Services/BilanService.php
app/Services/TreasuryService.php
app/Services/CashClosingService.php             (nouveau)
app/Services/AdCampaignService.php              (nouveau)
app/Services/AcademyReportService.php
app/Services/CommercialReportService.php
app/Services/ContractService.php
app/Services/ExpenseService.php
app/Services/PaymentService.php
app/Services/AccountingService.php
app/Support/Money.php                           (nouveau)
app/Support/GroupCurrency.php
app/Support/Period.php
app/Http/Controllers/Api/StatsController.php
app/Http/Controllers/Api/DashboardController.php
app/Http/Controllers/Api/InvoiceController.php
app/Http/Controllers/Api/AccountingController.php
app/Http/Controllers/Api/TreasuryController.php
app/Http/Controllers/Api/BilanController.php
app/Http/Controllers/Api/PaymentProofController.php
app/Http/Controllers/Api/ReportController.php
app/Http/Controllers/Api/ProspectController.php
app/Http/Controllers/Api/MetricsController.php  (nouveau)
app/Http/Controllers/Api/CashClosingController.php (nouveau)
app/Http/Middleware/InactivityLogout.php
routes/api.php
routes/console.php
```

### 17.2 Fichiers frontend principalement concernés

```
src/pages/dashboard/PEKEGNOGroupDashboard.tsx
src/pages/dashboard/CashierDashboardPage.tsx
src/pages/dashboard/CountryDashboardPage.tsx
src/pages/agency/AgencyDeptDashboardPage.tsx
src/pages/bilans/DailyBilanPage.tsx
src/pages/accounting/AccountingPage.tsx
src/pages/treasury/TreasuryPage.tsx
src/pages/treasury/CashClosingsPage.tsx         (nouveau)
src/pages/reports/ComparisonReportPage.tsx
src/pages/reports/CustomersReportPage.tsx
src/pages/invoices/InvoiceListPage.tsx
src/pages/academy/AcademyReportsPage.tsx
src/pages/academy/AcademyInvoicesPage.tsx
src/components/layout/navItems.ts
src/i18n/locales/fr.ts + en.ts
src/utils/format.ts                             (arrondi + devise)
```

### 17.3 Migrations à créer

1. `add_received_validated_at_to_invoice_payments`
2. `add_code_and_visibility_to_treasury_accounts`
3. `add_transfer_type_to_treasury_transactions`
4. `create_cash_closings_table`
5. `create_ad_campaigns_table`
6. `create_sale_rubrics_table` + rattachement
7. `add_event_id_to_expenses`
8. `add_branch_to_products_and_services`
9. `add_administration_type_to_agencies`
10. `add_category_id_to_invoice_items` (si absent) + backfill
11. `add_serial_number_to_certificates` (si absent)
12. `create_session_occurrences_table` (séances datées)

### 17.4 Endpoints à créer

| Méthode | Route | Usage |
|---|---|---|
| GET | `/api/metrics/summary` | 7 indicateurs + contrôle CA |
| GET | `/api/metrics/breakdown` | Ventilation par rubrique / branche / caisse |
| GET/POST | `/api/cash-closings` | Clôture journalière |
| POST | `/api/cash-closings/{id}/validate` | Validation chef d'agence |
| GET/POST | `/api/ad-campaigns` | Campagnes publicitaires |
| GET | `/api/public/certificates/{serial}/verify` | Vérification publique |
| GET | `/api/security/center` | Centre de sécurité Super Admin |

### 17.5 Matrice de visibilité des caisses

| Rôle | C | O | M | B |
|---|---|---|---|---|
| Caissier | ✅ | ❌ | ❌ | ❌ |
| Équipe agence | ✅ | ❌ | ❌ | ❌ |
| Responsable agence | ✅ | ❌ | ❌ | ❌ |
| Administration | ✅ | ✅ | ✅ | ✅ |
| Comptable | ✅ | ✅ | ✅ | ✅ |
| Direction générale | ✅ | ✅ | ✅ | ✅ |
| Super Admin | ✅ | ✅ | ✅ | ✅ |

### 17.6 Références internes

- `doc/A_FAIRE.md` — suivi des demandes déjà traitées (À jour au 16/10/2026).
- `doc/PLAN_EXECUTION.md` — plan d'exécution antérieur.
- `doc/audit.md` — audit technique.
- `doc/deploy/` — procédures de déploiement.
- `CLAUDE.md` — commandes de test et échecs connus.
