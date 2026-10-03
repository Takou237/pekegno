# Audit — Département Pekegno Agency

Rapport d'implémentation de la todo list `doc/AGENCY_A_FAIRE.md` (tâches #1 → #52, décisions D1 → D20).
Date : 2026-10-03 · Branche : `master` · **Rien n'est commité** · **Migrations lancées sur la base locale (Postgres `pekegno`) à la demande de Mike**.

---

## 1. Synthèse

| Élément | État |
|---|---|
| Todo list (#1 → #52) | ✅ codée en totalité |
| Décisions D1 → D20 | ✅ appliquées (D19 et D20 ajoutées en cours de route) |
| Tests backend Agency (`tests/Feature/AgencyDepartmentTest.php`) | ✅ **25 tests / 196 assertions OK** |
| Suite backend complète | ✅ 407 OK · ❌ 21 KO (**identiques avant/après** : extension PHP GD absente du conteneur, sans lien avec l'Agency) |
| Frontend `frontend/` | ✅ `tsc --noEmit` sans erreur · ✅ `vite build` OK |
| Portail `frontend_client/` | ✅ typecheck sans erreur (ses `node_modules` étant vides, vérifié avec les dépendances de `frontend/`) |
| Migrations sur la base locale Postgres | ✅ 12/12 passées (rattrapage comptable inclus) |
| Test de fumée PostgreSQL (21 routes GET Agency, super-admin) | ✅ toutes en 200 — a permis de corriger un bug propre à PostgreSQL (§6) |
| Recette manuelle dans le navigateur | ⚠️ **non faite** : à dérouler avec `doc/test.md` |
| ESLint | ⚠️ non exécutable : le projet n'a pas de `eslint.config.*` |

---

## 2. Décisions et où elles sont appliquées

| # | Décision | Implémentation |
|---|---|---|
| D1 | Le contrat est l'objet central ; `subscriptions` en lecture seule | Souscription ⇒ `Contract` (`origin=package`). Interrupteur `AGENCY_SUBSCRIPTIONS_READ_ONLY` (middleware `subscriptions.writable`, réponse 409). **Désactivé par défaut** : à activer *après* la reprise D16. |
| D2 | Table `agency_categories` (`kind` package / prestation) | Migration 000001, modèle `AgencyCategory`, `AgencyCategoryController` |
| D3 | Souscription ⇒ prestation pré-remplie | `PackageService::generatePrestation()` : 1 action par item du package |
| D4 | Budget des actions : blocage strict | `PrestationActionService::assertBudget()` ⇒ 422 « Budget restant insuffisant » ; le budget d'une prestation ne peut pas descendre sous l'alloué ; figé après création du contrat |
| D5 | Seul le client note | Notation uniquement via `PUT /api/client/prestation-actions/{id}/review` (portail client) ; staff en lecture seule |
| D6 | Commission au paiement | Déclenchement `on_payment` (moteur existant + taux prestation) |
| D7 / D15 | Budget pub client = pass-through (transite par Pekegno, hors CA) | Actions `is_pass_through` ⇒ ligne de facture `is_pass_through` ⇒ exclue du CA dans le bilan et les rapports, comptée dans les encaissements |
| D8 | Alertes J-30/15/7/1 configurables | `ContractService::getRenewAlertDays($departmentId)` (réglage par département puis global puis défaut) ; écran Paramètres du département |
| D9 | Validation : chef d'agence + direction | Permission `prestations.valider` (responsable-agence, direction-generale, super-admin) + contrôle de périmètre `ScopeService` |
| D10 | Contrat actif au 1er paiement ; PDF signé facultatif | `ContractService::activateOnFirstPayment()` appelé par `PaymentService::applyPayment()` ; `POST /contracts/{id}/sign` n'active pas |
| D11 | Une note par action, modifiable | Table `prestation_action_reviews` unique (action, client) ; upsert ; note prestation = moyenne des actions |
| D12 | Notable si en cours ou terminée | `Prestation::RATEABLE_STATUSES` ⇒ 422 sinon |
| D13 | Taux par package | `commission_rules.package_id` + matching dans `CommissionService` |
| D14 | Alertes : chef d'agence + client | `AgencyAlertService` : notification + tâche CRM `followup` au chef ; notification + e-mail au client ; **pas** le commercial |
| D16 | Reprise de tout l'historique | `php artisan agency:migrate-subscriptions [--dry-run]` (idempotent via `contracts.legacy_subscription_id`) |
| D17 | Taux saisi sur prestation hors package | `prestations.commission_type/commission_value` ; `CommissionService::recordPrestationRate()` (base = honoraires, hors pass-through) |
| D18 | Rappel client : e-mail + portail | `ContractRenewalReminderMail` + `agency_notifications` + page Notifications du portail |
| D19 | Commissions hors du menu, dans Paramètres | Item retiré de `navItems.ts` ; lien dans `AgencySettingsSection` |
| D22 | Pas de menu « Souscriptions » : une souscription est un contrat | Entrée retirée ; onglets « Tous / Packages souscrits / Prestations / Manuels » sur Contrats (`?origin=`) ; `…/subscriptions` redirige vers `…/contracts?origin=package` |
| D21 | Suivi des prestations dans Prestations | Plus d'entrée de menu ; onglets « Liste / Suivi des prestations » (`PrestationTabs`) sur la page Prestations |
| D20 | Comptabilité / Bilan limités au département | `accounting_transactions.department_id` + `DepartmentLedger` + filtres `department_id` (compta, bilan jour/période, export) |

---

## 3. Fichiers

### 3.1 Backend — nouveaux

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_10_03_000001` → `000012` | Schéma Agency (voir §4) + permissions + `department_id` comptable (avec rattrapage) |
| `database/seeders/AgencyPackageSeeder.php` | Packages du flyer + services à la carte + rôles d'équipe par défaut — **non branché sur DatabaseSeeder** |
| `app/Models/` : `AgencyCategory`, `ClientTeamRole`, `PackageItem`, `PackageRecommendation`, `Prestation`, `PrestationAction`, `PrestationActionComment`, `PrestationActionLog`, `PrestationActionReview`, `PrestationTeamMember`, `AgencyNotification` | Modèles |
| `app/Services/PackageService.php` | Souscription ⇒ contrat + prestation + facture (+ avance) |
| `app/Services/PrestationService.php` | Workflow de statuts, validation ⇒ contrat + facture, suspension / reprise / annulation répercutées sur le contrat |
| `app/Services/PrestationActionService.php` | Actions : budget strict, statuts, commentaires, journal d'exécution, progression, alertes budget 80 % / 100 % |
| `app/Services/PrestationReviewService.php` | Notes : upsert, moyenne, distribution, agrégats |
| `app/Services/AgencyInvoicingService.php` | Factures de contrats (honoraires + ligne pass-through) |
| `app/Services/AgencyRenewalService.php` | Renouvellement Agency : contrat enfant + facture (+ nouvelle prestation pour un package) |
| `app/Services/AgencyAlertService.php` | Renouvellements (statut, alertes, tâches, e-mail), expirations, actions en retard |
| `app/Services/AgencyNotifier.php` | Notifications in-app (dédoublonnées), chefs d'agence, responsables de prestation |
| `app/Services/AgencyAccessService.php` | Périmètre : agence (ScopeService) + commercial = ses ventes + community-manager = ses prestations |
| `app/Services/AgencyReportService.php` | KPI / rapports (CA hors pass-through, MRR, créances, renouvellement, notes, tops) |
| `app/Services/SubscriptionMigrationService.php` | Reprise D16 |
| `app/Services/DepartmentLedger.php` | D20 : rattachement factures / écritures à un département |
| `app/Http/Controllers/Api/Agency/*` | `AgencyCategory`, `Package`, `Prestation`, `PrestationAction`, `ClientTeam`, `PrestationReview`, `AgencyNotification`, `AgencyReport`, `AgencySettings` |
| `app/Http/Controllers/Api/Client/ClientPrestationController.php` | Portail client : mes prestations + notation |
| `app/Http/Middleware/EnsureSubscriptionsWritable.php`, `config/agency.php` | Interrupteur D1 |
| `app/Console/Commands/AgencyCheckRenewalsCommand.php` | `agency:check-renewals` (planifiée 06:15) |
| `app/Console/Commands/AgencyMigrateSubscriptionsCommand.php` | `agency:migrate-subscriptions` |
| `app/Mail/ContractRenewalReminderMail.php`, `resources/views/emails/contract-renewal-reminder.blade.php` | E-mail client |
| `resources/views/pdf/contract.blade.php` | PDF du contrat (3 parties, période, budget, contenu) |
| `tests/Feature/AgencyDepartmentTest.php` | 25 tests |

### 3.2 Backend — modifiés

| Fichier | Changement |
|---|---|
| `Models/SubscriptionPack.php` | Devient le « package » (catégorie, accroche, prix barré, période, items, recommandations, promotions, `effective_price`) |
| `Models/Contract.php` | Statuts `draft`, `pending`, `renewed` ; origine ; prestation ; commercial ; budget alloué ; activation / signature ; relations factures |
| `Models/Invoice.php`, `InvoiceItem.php`, `Promotion.php`, `CommissionRule.php`, `AccountingTransaction.php` | Champs Agency (`contract_id`, `package_id`, `prestation_id`, `is_pass_through`, `department_id`) |
| `Services/ContractService.php` | Création depuis prestation / package, activation au 1er paiement, suspension / reprise, renouvellement, délais d'alerte par département |
| `Services/PaymentService.php` | Appelle `activateOnFirstPayment()` |
| `Services/CommissionService.php` | Règles par package + taux de prestation hors package |
| `Services/BilanService.php` | Bloc Agency, exclusion pass-through du CA, vue par département |
| `Services/AccountingService.php`, `ExpenseService.php` | Renseignent `department_id` |
| `Controllers/Api/ContractController.php` | Filtres (département, origine…), périmètre, suspend / resume / sign / pdf, résiliation ⇒ prestation annulée, renouvellement Agency |
| `Controllers/Api/InvoiceController.php` | Filtres `from_contracts`, `contract_department_id`, `contract_id` |
| `Controllers/Api/CommissionController.php` | `package_id` sur les règles ; filtres `category`, `agency_id` sur les commissions |
| `Controllers/Api/AccountingController.php`, `BilanController.php`, `ExportController.php` | Filtre `department_id` |
| `Controllers/Api/ActivityLogController.php` | Filtre `entity_id` (onglet Historique) |
| `database/seeders/PermissionSeeder.php`, `RoleSeeder.php` | Permissions Agency + rôle `community-manager` |
| `routes/api.php`, `routes/console.php`, `bootstrap/app.php` | Routes, planification, alias middleware |

### 3.3 Frontend `frontend/`

| Fichier | Rôle |
|---|---|
| `components/layout/navItems.ts` | Menu Agency : **Academy retiré**, **Commissions retiré** (D19), **Suivi des prestations déplacé en onglet de Prestations** (D21), nouvelles entrées |
| `router/index.tsx` | Routes Agency ; `ByDepartmentType` résout les chemins partagés (`''`, `invoices`, `receivables`, `commissions`, `reports`, `planning`) |
| `components/departments/ByDepartmentType.tsx` | Choix de la page selon le type de département |
| `pages/agency/AgencyDeptDashboardPage.tsx` | Tableau de bord |
| `pages/agency/AgencyDeptPackagesPage.tsx` | Packages (cartes flyer), formulaire, promotions, souscription |
| `pages/agency/PrestationListPage.tsx`, `PrestationDetailPage.tsx` | Prestations + fiche à 6 onglets |
| `pages/agency/PrestationTrackingPage.tsx` | Grand tableau Prestations · Notes · Statut · Motif (+ export CSV) |
| `pages/agency/AgencyActionsBoardPage.tsx` | Community Management / Publicité |
| `pages/agency/ClientTeamPage.tsx` | Équipe client |
| `pages/agency/ContractListPage.tsx`, `ContractDetailPage.tsx`, `RenewalsPage.tsx` | **Réécrites** (voir §6) ; onglets d'origine (`?origin=`) qui remplacent l'ancienne page Souscriptions (D22) |
| `pages/agency/AgencyDept{Invoices,Receivables,Commissions,Reports}Page.tsx` | Finance et rapports |
| `components/agencyDept/*` | Badges, étoiles Play Store, motif, sélecteurs, formulaire prestation, section Paramètres, onglet client |
| `api/agencyDepartment.api.ts`, `types/agencyDepartment.ts`, `utils/agencyDeptPermissions.ts`, `hooks/useAgencyDept.ts` | API, types, droits d'affichage, contexte |
| `pages/departments/DepartmentListPage.tsx` | **Badge de type** sur chaque carte de département |
| `pages/departments/DepartmentSettingsPage.tsx` | Section Paramètres Agency |
| `pages/clients/ClientDetailPage.tsx` | Onglet Agency (packages, prestations, contrats) |
| `pages/bilans/DailyBilanPage.tsx`, `pages/accounting/AccountingPage.tsx`, `pages/academy/Academy{Bilan,Accounting}Page.tsx` | Lignes Agency + périmètre département (D20) |
| `pages/invoices/InvoiceListPage.tsx` | Prop `contractDepartmentId` |
| `api/contracts.api.ts`, `types/*.ts`, `i18n/locales/{fr,en}.ts` | API / types / traductions (bloc `agencyDept`) |

### 3.4 Portail client `frontend_client/`

`api/agency.api.ts`, `pages/account/PrestationsPage.tsx` (notation 5★ par action), `pages/account/NotificationsPage.tsx`, `layouts/AccountLayout.tsx` (menu + cloche avec compteur), `router/index.tsx`, `i18n/locales/{fr,en}.ts`.

---

## 4. Modèle de données (12 migrations)

| Migration | Contenu |
|---|---|
| 000001 | `agency_categories` |
| 000002 | `client_team_roles` |
| 000003 | `subscription_packs` + code, département, catégorie, accroche, prérequis, prix barré, « à partir de », période, engagement min, ordre, public, image |
| 000004 | `package_items`, `package_recommendations` |
| 000005 | `promotions.package_id` |
| 000006 | `prestations`, `prestation_team_members` |
| 000007 | `prestation_actions`, `prestation_action_comments`, `prestation_action_logs`, `prestation_action_reviews` (unique action + client) |
| 000008 | `contracts` + origine, prestation, commercial, budget alloué, activation, signature, motif suspension, `legacy_subscription_id` (unique) |
| 000009 | `invoices.contract_id`, `invoice_items.package_id/prestation_id/is_pass_through`, `commission_rules.package_id` |
| 000010 | `agency_notifications` (unique utilisateur + `dedupe_key`) |
| 000011 | Permissions Agency + rôle `community-manager` + attributions (pour une base existante, comme `grant_cashier_commission_payment`) |
| 000012 | `accounting_transactions.department_id` + **rattrapage** des écritures existantes |

Toutes ont un `down()`. 000011 ne retire rien au rollback (même choix que la migration existante du caissier).

---

## 5. Sécurité et permissions

| Rôle | Packages | Prestations | Valider | Actions | Équipe client |
|---|---|---|---|---|---|
| super-admin / direction-generale | tout | tout | ✅ | tout | gérer |
| responsable-agence | tout | tout | ✅ (son périmètre) | tout | gérer |
| responsable-departement | créer / modifier | créer / modifier / exporter | ❌ | tout | gérer |
| commercial | consulter | consulter / créer (**ses ventes uniquement**) | ❌ | consulter | consulter |
| community-manager (nouveau) | consulter | consulter (**celles où il est membre / assigné**) | ❌ | consulter / modifier (statut, coût, commentaire) | consulter |
| caissier | consulter | consulter | ❌ | — | — |
| comptable | consulter | consulter / exporter | ❌ | — | — |
| client | — (portail : ses prestations, notation de ses actions) | | | | |

- Le backend est la source de vérité : chaque route a un middleware `permission:` et `AgencyAccessService` applique le périmètre (403 sinon).
- Un commercial qui crée une prestation ou une souscription est forcé comme vendeur (pas de vente au nom d'un collègue).
- Le portail client : 404 sur toute prestation qui n'est pas la sienne ; les brouillons et refus ne sont pas visibles.
- Toutes les mutations sensibles passent par `ActivityLogger` (création, statuts, budget, validation, notes avant/après, contrats, commissions).

---

## 6. Bugs existants corrigés au passage

| Fichier | Bug |
|---|---|
| `pages/agency/ContractDetailPage.tsx` | lisait `useParams().id` alors que la route fournit `contractId` ⇒ la fiche ne chargeait jamais |
| `api/contracts.api.ts` | résiliation envoyée avec `terminated_reason`, le backend attend `reason` ⇒ 422 systématique |
| `pages/agency/RenewalsPage.tsx`, `ContractListPage.tsx` | liens vers `/contracts/:id` (route inexistante) |
| `components/layout/navItems.ts` | « Factures » Agency pointait sur `payments` = page vendeurs de l'Academy |
| `router/index.tsx` | chemin `planning` déclaré deux fois ; `reports` / `receivables` / `prospects` affichaient toujours les pages Academy |
| `Services/BilanService.php`, `AgencyReportService.php` (code de ce chantier) | `GROUP BY kind` : PostgreSQL le résolvait sur la colonne `agency_categories.kind` et non sur l'alias ⇒ erreur SQL sur le bilan. Invisible sous SQLite (tests) ; corrigé avec `groupByRaw` et des alias distincts. |

---

## 7. Limites connues / points d'attention

1. **Migrations** : lancées sur la base locale de Mike ; à lancer sur toute autre base (`php artisan migrate`). Le test de fumée a dû créer un jeton temporaire admin : la session de navigateur de `admin@pekegno.com` a été déconnectée (reconnexion nécessaire) ; le jeton a été supprimé ensuite. Le seeder des packages n'a **pas** été lancé.
2. **Une facture par contrat**, payable en N versements (vente ≠ paiement, cahier §11.1). Il n'y a pas d'échéancier mensuel automatique (une facture par mois). Le renouvellement crée la facture de la période suivante.
3. **Interrupteur D1** désactivé par défaut. Ordre conseillé : sauvegarde ⇒ `agency:migrate-subscriptions --dry-run` ⇒ `agency:migrate-subscriptions` ⇒ `AGENCY_SUBSCRIPTIONS_READ_ONLY=true`.
4. **Le seeder des packages du flyer n'est pas lancé** : `php artisan db:seed --class=AgencyPackageSeeder` (idempotent).
5. **Rattrapage D20** : pour les anciennes écritures, il est fait depuis la facture (contrat ⇒ département ; inscription ⇒ département Academy de l'agence) et depuis la dépense (`expenses.department_id`). Une écriture manuelle ancienne, sans lien, reste rattachée à l'agence seulement : elle n'apparaît pas dans la compta d'un département.
6. **Bilan par département** : le « solde initial » est le cumul encaissements − dépenses du département, et le « solde trésorerie réel » n'est pas affiché (la trésorerie est tenue par agence).
7. **Commissions payées** (`commission_payments`) : l'écriture de dépense correspondante n'est pas rattachée à un département.
8. **Pas de SMS / WhatsApp** pour les rappels (D18).
9. **Planification** : `agency:check-renewals` tourne via le scheduler Laravel (`schedule:run` doit être actif en production, comme pour `subscriptions:check-expiry`).
10. Les noms de pages `Agency*` existaient déjà pour l'entité *agence* : les nouvelles pages du *département* Agency sont préfixées `AgencyDept*`.
11. `CommissionController::indexRules` utilise `DISTINCT ON` (PostgreSQL uniquement) : comportement existant, non testable sous SQLite.

---

## 8. Déploiement

```bash
cd backend
php artisan migrate                                  # 12 migrations Agency
php artisan db:seed --class=AgencyPackageSeeder      # facultatif : packages du flyer
php artisan agency:migrate-subscriptions --dry-run   # simulation de la reprise D16
php artisan agency:migrate-subscriptions             # reprise réelle (après sauvegarde)
# puis dans .env : AGENCY_SUBSCRIPTIONS_READ_ONLY=true
php artisan config:clear
```

Frontends : `npm run build` dans `frontend/` et `frontend_client/` (après `npm ci` pour le portail client, dont les `node_modules` sont vides en local).
