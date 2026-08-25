# Rapport d'exécution — Sprint 3, 4 & 5

**Projet** : PEKEGNO Management System  
**Branche** : `dev/local`  
**Date** : 25 août 2026  
**Derniers commits** :
- `3161b82` feat: sprint 4 — CRM complet
- `02cf840` feat: sprint 3 — dépenses & moteur de commissions
- `73e1af5` feat: sprint 2 — treasury, payment, bilan
- `af9ae98` feat: sprint 1 — department types, scope, org context

---

## Sommaire rapide

| Sprint | Statut | Lignes ajoutées | Fichiers |
|--------|--------|-----------------|----------|
| **Sprint 3** — Dépenses & Commissions | ✅ Terminé | ~2 530 | 24 |
| **Sprint 4** — CRM complet | ✅ Terminé | ~2 890 | 27 |
| **Sprint 5** — Billing & Finance avancé | ⏳ Non démarré | — | — |

---

## Sprint 3 — Dépenses & Moteur de Commissions Versionné

**Commit** : `02cf840`  
**Durée estimée** : 3 jours  
**Résultat** : Développement complet backend + frontend

### Migrations (3 tables)

#### `expenses`
| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID PK | | Identifiant |
| `number` | VARCHAR(20) | UNIQUE, NOT NULL | Numéro auto EXP-XXXXX |
| `agency_id` | UUID FK → agencies | NOT NULL | Agence rattachée |
| `department_id` | UUID FK → departments | nullable | Département |
| `category_id` | UUID FK → accounting_categories | NOT NULL | Catégorie comptable |
| `amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Montant |
| `status` | VARCHAR(20) | DEFAULT 'draft' | Statut workflow |
| `expense_date` | DATE | NOT NULL | Date de la dépense |
| `note` | TEXT | nullable | Description |
| `justification_path` | VARCHAR(255) | nullable | Justificatif |
| `requested_by` | UUID FK → users | nullable | Demandeur |
| `approved_by` | UUID FK → users | nullable | Approbateur |
| `approved_at` | TIMESTAMP | nullable | Date d'approbation |
| `rejected_by` | UUID FK → users | nullable | Rejeteur |
| `rejection_reason` | VARCHAR(255) | nullable | Raison du rejet |
| `treasury_account_id` | UUID FK → treasury_accounts | nullable | Compte trésorerie utilisé |
| `paid_by` | UUID FK → users | nullable | Payeur |
| `paid_at` | TIMESTAMP | nullable | Date de paiement |

**CHECK** : `expenses_status_check` — `draft`, `submitted`, `approved`, `rejected`, `paid`, `closed`

#### `commission_rules`
| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID PK | | Identifiant |
| `rule_group_id` | UUID | NOT NULL | Groupe de version |
| `version` | INTEGER | DEFAULT 1 | Numéro de version |
| `name` | VARCHAR(200) | NOT NULL | Nom de la règle |
| `is_active` | BOOLEAN | DEFAULT true | Active |
| `trigger` | VARCHAR(20) | NOT NULL | Déclencheur |
| `formula` | VARCHAR(20) | NOT NULL | Type de formule |
| `percent_value` | DECIMAL(5,2) | nullable | Pourcentage |
| `fixed_amount` | DECIMAL(15,2) | nullable | Montant fixe |
| `tiered_config` | JSON | nullable | Configuration paliers |
| `department_id` | UUID FK | nullable | Département ciblé |
| `created_by` | UUID FK → users | nullable | Créateur |

**CHECK** : `commission_rules_trigger_check` — `on_sale`, `on_payment`, `on_full_payment`  
**CHECK** : `commission_rules_formula_check` — `percent`, `fixed`, `tiered`  
**INDEX** : `(rule_group_id, version)`

#### `commission_entries`
| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID PK | | Identifiant |
| `invoice_id` | UUID FK → invoices | NOT NULL | Facture liée |
| `rule_id` | UUID FK → commission_rules | nullable | Règle appliquée |
| `rule_snapshot` | JSON | nullable | Snapshot immutable de la règle |
| `commercial_id` | UUID FK → commercials | NOT NULL | Commercial bénéficiaire |
| `agency_id` | UUID FK → agencies | NOT NULL | Agence |
| `amount` | DECIMAL(15,2) | NOT NULL, CHECK > 0 | Montant commission |
| `base_amount` | DECIMAL(15,2) | nullable | Montant de base |
| `status` | VARCHAR(20) | DEFAULT 'calculated' | Statut |
| `validated_at` | TIMESTAMP | nullable | Date validation |
| `paid_at` | TIMESTAMP | nullable | Date paiement |

**CHECK** : `commission_entries_status_check` — `calculated`, `validated`, `paid`, `cancelled`

### Modèles

#### `Expense`
- Statuts : `STATUS_DRAFT → STATUS_SUBMITTED → STATUS_APPROVED → STATUS_PAID → STATUS_CLOSED`
- Rejet : `STATUS_SUBMITTED → STATUS_REJECTED → STATUS_DRAFT` (rouverture)
- `generateNextNumber()` : format `EXP-XXXXX`
- Relations : `agency`, `category`, `requestor`, `approver`, `rejector`, `payer`, `treasuryAccount`, `department`
- Scopes : `ofStatus`, `ofAgency`, `betweenDates`

#### `CommissionRule`
- Gestion versionnée : `rule_group_id` + `version`
- `computeAmount()` : calcule le montant selon `percent`, `fixed` ou `tiered`
- `snapshot()` : retourne un JSON immutable de la règle pour l'historique
- `scopeActive()` : uniquement les règles actives

#### `CommissionEntry`
- Statuts : `calculated → validated → paid` ou `calculated → cancelled`
- `transitionTo($status)` : vérifie la validité de la transition

### Services

#### `ExpenseService`
- `submit()` : draft → submitted
- `approve()` : submitted → approved
- `reject($reason)` : submitted → rejected (raison obligatoire)
- `pay($accountId)` : approved → paid (atome : mouvement trésorerie **out** + écriture comptable)
- `close()` : paid → closed
- `reopen()` : rejected → draft
- `assertTransition()` : vérifie la validité de chaque transition
- `writeExpenseAccounting()` : écriture comptable automatique

#### `CommissionService` (étendu)
- `callEvaluateRulesForPayment()` : évalue les règles actives en priorité, fallback historique préservé
- `createEntries()` : crée les entrées de commission avec snapshot immutable
- `ruleMatchesInvoice()` : vérifie si une règle s'applique à une facture
- `resolveDepartmentForInvoice()` : résout le département de la facture
- `baseForRule()` : calcule le montant de base selon la formule
- `recordFallback()` : enregistre les commissions sans règle (historique)

### Contrôleurs

#### `ExpenseController`
| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `index` | GET `/expenses` | `depenses.consulter` | Liste filtrée + pagination |
| `store` | POST `/expenses` | `depenses.creer` | Créer (draft) |
| `show` | GET `/expenses/{id}` | `depenses.consulter` | Détail avec relations |
| `update` | PUT `/expenses/{id}` | `depenses.modifier` | Modifier (draft seulement) |
| `destroy` | DELETE `/expenses/{id}` | `depenses.supprimer` | Supprimer (draft/rejetée) |
| `submit` | POST `/expenses/{id}/submit` | `depenses.modifier` | Soumettre |
| `approve` | POST `/expenses/{id}/approve` | `depenses.valider` | Approuver |
| `reject` | POST `/expenses/{id}/reject` | `depenses.valider` | Rejeter (raison requise) |
| `pay` | POST `/expenses/{id}/pay` | `depenses.encaisser` | Payer (trésorerie + comptabilité) |
| `close` | POST `/expenses/{id}/close` | `depenses.modifier` | Clôturer |
| `reopen` | POST `/expenses/{id}/reopen` | `depenses.modifier` | Rouvrir |

#### `CommissionController`
| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `indexRules` | GET `/commission-rules` | `commissions.consulter` | Liste des règles |
| `storeRule` | POST `/commission-rules` | `commissions.creer` | Créer une règle |
| `updateRule` | PUT `/commission-rules/{id}` | `commissions.modifier` | Modifier (nouvelle version) |
| `ruleVersions` | GET `/commission-rules/{id}/versions` | `commissions.consulter` | Historique versions |
| `destroyRule` | DELETE `/commission-rules/{id}` | `commissions.supprimer` | Désactiver |
| `indexEntries` | GET `/commissions/entries` | `commissions.consulter` | Liste des entrées |
| `validateEntry` | POST `/commissions/entries/{id}/validate` | `commissions.valider` | Valider |
| `payEntry` | POST `/commissions/entries/{id}/pay` | `commissions.valider` | Payer |
| `cancelEntry` | POST `/commissions/entries/{id}/cancel` | `commissions.valider` | Annuler |

### Permissions ajoutées

```
depenses.consulter, depenses.creer, depenses.modifier, depenses.supprimer,
depenses.valider, depenses.encaisser, depenses.exporter

commissions.consulter, commissions.creer, commissions.modifier, commissions.supprimer,
commissions.valider, commissions.encaisser, commissions.exporter
```

### Attribution rôles

| Rôle | Dépenses | Commissions |
|------|----------|-------------|
| `super-admin` | Toutes | Toutes |
| `direction-generale` | Toutes | Toutes |
| `responsable-agence` | consulter, créer, modifier, valider, encaisser, exporter | consulter, créer, modifier, valider, encaisser, exporter |
| `responsable-departement` | consulter, créer, modifier | consulter |
| `caissier` | consulter, créer, encaisser | consulter |
| `comptable` | Toutes | Toutes |

### Frontend

| Fichier | Description |
|---------|-------------|
| `src/types/expenses.ts` | Types `Expense`, `ExpenseStatus`, `ExpenseListParams`, `ExpenseListResponse`, `ExpenseCreatePayload` |
| `src/types/commissions.ts` | Types `CommissionRule`, `CommissionEntry`, `CommissionEntryStatus`, `CommissionRulePayload`, `CommissionEntryListParams`, `CommissionEntryListResponse` |
| `src/api/expenses.api.ts` | Client API : `list`, `get`, `create`, `update`, `remove`, `submit`, `approve`, `reject`, `pay`, `close`, `reopen` |
| `src/api/commissions.api.ts` | Client API : `listRules`, `createRule`, `updateRule`, `ruleVersions`, `deactivateRule`, `listEntries`, `validateEntry`, `payEntry`, `cancelEntry` |
| `src/pages/expenses/ExpenseListPage.tsx` | Table avec filtres statut/recherche, modals créer/rejeter/payer/détail, boutons workflow |
| `src/pages/commissions/CommissionRulesPage.tsx` | CRUD règles, modal historique versions |
| `src/pages/commissions/CommissionEntriesPage.tsx` | Table filtrable, actions valider/payer/annuler |
| `src/router/index.tsx` | Routes `/expenses`, `/commissions/rules`, `/commissions/entries` |
| `src/components/layout/navItems.ts` | Nav: `CircleDollarSign` dépenses, `ScrollText` commissions pour responsable-agence, comptable, caissier |
| `src/i18n/locales/fr.ts` | Traductions complètes dépenses + commissions |
| `src/i18n/locales/en.ts` | Traductions complètes dépenses + commissions |

### Tests API validés

```
✅ Création dépense (draft) → Soumission → Approbation → Paiement (trésorerie out + écriture comptable) → Clôture
✅ Transition invalide draft→approve → 422
✅ Création règle commission 10% → Facture 200 000 → Entry 20 000 calculée automatiquement
✅ Rule snapshot JSON immutable
✅ TypeScript tsc --noEmit → 0 erreur
✅ Swagger régénéré
```

---

## Sprint 4 — CRM Complet (Entreprises, Pipeline, Activités)

**Commit** : `3161b82`  
**Durée estimée** : 5 jours  
**Résultat** : Développement complet backend + frontend

### Migrations (3 tables)

#### `companies`
| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID PK | | Identifiant |
| `name` | VARCHAR(150) | NOT NULL | Nom de l'entreprise |
| `industry` | VARCHAR(100) | nullable | Secteur d'activité |
| `phone` | VARCHAR(50) | nullable | Téléphone |
| `email` | VARCHAR(255) | nullable | Email |
| `address` | VARCHAR(255) | nullable | Adresse |
| `city` | VARCHAR(100) | nullable | Ville |
| `country` | VARCHAR(100) | nullable | Pays |
| `website` | VARCHAR(150) | nullable | Site web |
| `deleted_at` | TIMESTAMP | nullable | Soft deletes |

**INDEX** : `name`

**ALTER prospects** : ajout `company_id` UUID FK → companies (nullable, nullOnDelete)

#### `opportunities`
| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID PK | | Identifiant |
| `title` | VARCHAR(200) | NOT NULL | Titre de l'opportunité |
| `prospect_id` | UUID FK → prospects | nullable | Prospect lié (cascadeOnDelete) |
| `client_id` | UUID FK → users | nullable | Client lié (nullOnDelete) |
| `company_id` | UUID FK → companies | nullable | Entreprise (nullOnDelete) |
| `agency_id` | UUID FK → agencies | NOT NULL | Agence (cascadeOnDelete) |
| `department_id` | UUID FK → departments | nullable | Département (nullOnDelete) |
| `commercial_id` | UUID FK → commercials | NOT NULL | Commercial (cascadeOnDelete) |
| `stage` | VARCHAR(20) | DEFAULT 'new' | Stage du pipeline |
| `expected_amount` | DECIMAL(15,2) | nullable | Montant attendu |
| `expected_close_date` | DATE | nullable | Date de clôture prévue |
| `won_at` | TIMESTAMP | nullable | Date de victoire |
| `lost_at` | TIMESTAMP | nullable | Date de perte |
| `loss_reason` | TEXT | nullable | Raison de la perte |
| `deleted_at` | TIMESTAMP | nullable | Soft deletes |

**CHECK** : `opportunities_stage_check` — `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`, `lost`  
**INDEX** : `stage`, `commercial_id`, `agency_id`

#### `activities`
| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID PK | | Identifiant |
| `subject_type` | VARCHAR(50) | NOT NULL | Type polymorphique (ex: `App\Models\Opportunity`) |
| `subject_id` | UUID | NOT NULL | ID du sujet |
| `assigned_to` | UUID FK → users | nullable | Assigné à (nullOnDelete) |
| `created_by` | UUID FK → users | nullable | Créé par (nullOnDelete) |
| `type` | VARCHAR(20) | NOT NULL | Type d'activité |
| `title` | VARCHAR(200) | NOT NULL | Titre |
| `notes` | TEXT | nullable | Notes |
| `due_at` | TIMESTAMP | nullable | Échéance |
| `completed_at` | TIMESTAMP | nullable | Date de complétion |
| `outcome` | VARCHAR(255) | nullable | Résultat |

**CHECK** : `activities_type_check` — `call`, `meeting`, `email`, `whatsapp`, `note`, `followup`  
**INDEX** : `(subject_type, subject_id)`, `(assigned_to, due_at)`

### Modèles

#### `Company`
- `HasUuids`, `SoftDeletes`
- Relations : `prospects()` (hasMany), `opportunities()` (hasMany)
- Recherche par nom, email, téléphone

#### `Opportunity`
- Constante `STAGES` : `['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']`
- Casts : `expected_amount` (decimal), `expected_close_date` (date), `won_at`/`lost_at` (datetime)
- Relations : `prospect`, `client`, `company`, `agency`, `department`, `commercial`, `activities` (morphMany)
- Scopes : `ofStage`, `ofCommercial`, `ofAgency`, `won`, `open`

#### `Activity`
- Constante `TYPES` : `['call', 'meeting', 'email', 'whatsapp', 'note', 'followup']`
- Casts : `due_at`, `completed_at` (datetime)
- Relations : `subject` (morphTo), `assignee`, `creator`
- Scopes : `overdue` (due_at < now, not completed), `upcoming` (7 jours), `forSubject`
- Méthodes : `complete($outcome)` — marque comme complétée
- Accessors : `is_completed`, `is_overdue`

#### Prospect (modifié)
- Ajout `company_id` au fillable
- Relations ajoutées : `company()` (belongsTo Company), `activities()` (morphMany), `opportunities()` (hasMany)

### Services

#### `OpportunityService` (non créé — logique dans le contrôleur)
- Transitions de stage tracées via `ActivityLogger`
- `won_at` automatique au passage en `won`
- `lost_at` + `loss_reason` au passage en `lost`

### Contrôleurs

#### `CompanyController`
| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `index` | GET `/companies` | `entreprises.consulter` | Liste avec search, filtre industry, pagination |
| `store` | POST `/companies` | `entreprises.creer` | Créer une entreprise |
| `show` | GET `/companies/{id}` | `entreprises.consulter` | Détail avec withCount prospects/opportunities |
| `update` | PUT `/companies/{id}` | `entreprises.modifier` | Modifier |
| `destroy` | DELETE `/companies/{id}` | `entreprises.supprimer` | Soft delete |
| `search` | GET `/companies/search` | `entreprises.consulter` | Autocomplete (q → résultats limités) |

#### `OpportunityController`
| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `index` | GET `/opportunities` | `opportunites.consulter` | Liste filtrée par stage, commercial, agence, recherche |
| `store` | POST `/opportunities` | `opportunites.creer` | Créer (stage=new par défaut) |
| `show` | GET `/opportunities/{id}` | `opportunites.consulter` | Détail avec toutes les relations |
| `update` | PUT `/opportunities/{id}` | `opportunites.modifier` | Modifier les champs |
| `changeStage` | POST `/opportunities/{id}/stage` | `opportunites.modifier` | Changer le stage (transitions libres tracées) |
| `destroy` | DELETE `/opportunities/{id}` | `opportunites.supprimer` | Soft delete |
| `pipeline` | GET `/opportunities/pipeline` | `opportunites.consulter` | Vue pipeline (compteur + total par stage, stages ouverts uniquement) |

#### `ActivityController`
| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| `index` | GET `/activities` | `activites.consulter` | Liste filtrée par subject, type, assigné, overdue, completed |
| `store` | POST `/activities` | `activites.creer` | Créer une activité |
| `show` | GET `/activities/{id}` | `activites.consulter` | Détail avec subject |
| `update` | PUT `/activities/{id}` | `activites.modifier` | Modifier |
| `complete` | POST `/activities/{id}/complete` | `activites.modifier` | Marquer complétée (outcome optionnel) |
| `destroy` | DELETE `/activities/{id}` | `activites.supprimer` | Supprimer |
| `timeline` | GET `/crm/timeline` | `activites.consulter` | Timeline unifiée CRM par subject |

### Permissions ajoutées

```
entreprises.consulter, entreprises.creer, entreprises.modifier, entreprises.supprimer, entreprises.exporter
opportunites.consulter, opportunites.creer, opportunites.modifier, opportunites.supprimer, opportunites.exporter
activites.consulter, activites.creer, activites.modifier, activites.supprimer
```

### Attribution rôles

| Rôle | Entreprises | Opportunités | Activités |
|------|-------------|-------------|-----------|
| `super-admin` | Toutes | Toutes | Toutes |
| `direction-generale` | Toutes | Toutes | Toutes |
| `responsable-agence` | CRUD + export | CRUD + export | CRUD |
| `responsable-departement` | CRUD | CRUD | CRUD |
| `commercial` | CRU | CRUD | CRUD |
| `comptable` | lecture + export | lecture + export | lecture |

### Frontend

| Fichier | Description |
|---------|-------------|
| `src/types/company.ts` | Types `Company`, `CompanyPayload`, `CompanyListParams`, `CompanyListResponse` |
| `src/types/opportunity.ts` | Types `Opportunity`, `OpportunityPayload`, `OpportunityStage`, `OpportunityListParams`, `OpportunityListResponse`, `PipelineEntry`, constantes `STAGE_LABELS`, `STAGE_COLORS`, `OPEN_STAGES` |
| `src/types/activity.ts` | Types `Activity`, `ActivityPayload`, `ActivityType`, `ActivityListParams`, `ActivityListResponse`, constantes `ACTIVITY_TYPE_LABELS`, `ACTIVITY_TYPE_ICONS` |
| `src/api/companies.api.ts` | Client API : `list`, `get`, `create`, `update`, `remove`, `search` |
| `src/api/opportunities.api.ts` | Client API : `list`, `get`, `create`, `update`, `remove`, `changeStage`, `pipeline` |
| `src/api/activities.api.ts` | Client API : `list`, `get`, `create`, `update`, `remove`, `complete`, `timeline` |
| `src/pages/opportunities/OpportunityKanbanPage.tsx` | **Kanban 7 colonnes** : drag & drop HTML5 natif, compteurs + totaux par stage, filtres recherche/commercial, bouton créer par stage, modals |
| `src/pages/companies/CompanyListPage.tsx` | Table CRUD : search, pagination, modals créer/modifier/supprimer, compteurs prospects/opportunities |
| `src/pages/opportunities/OpportunityDetailPage.tsx` | Détail : info, stage change buttons, activities timeline, quick create activity, complete, delete |
| `src/pages/clients/ClientDetailPage.tsx` | Modifié : ajout onglet **Timeline** avec activities par client |
| `src/router/index.tsx` | Routes `/companies`, `/opportunities`, `/opportunities/:id` |
| `src/components/layout/navItems.ts` | Nav: `Target` opportunités + `Building2` entreprises pour responsable-agence, commercial, comptable |
| `src/i18n/locales/fr.ts` | Sections `companies`, `opportunities`, `activities` + `clientDetail.timeline` |
| `src/i18n/locales/en.ts` | Sections `companies`, `opportunities`, `activities` + `clientDetail.timeline` |

### Tests API validés

```
✅ Company: création TechCorp Africa → liste (count=1) → search
✅ Prospect: création Jean Ngo Bibam avec company_id
✅ Opportunity: création "Formation React Avance" (stage=new, expected_amount=500000)
✅ Stage transitions: new → contacted → qualified → won (tracées avec timestamps)
✅ Activity: création "Appel de qualification" (type=call, due_at) → complete (outcome="Interessé, rdv pris")
✅ Pipeline view: stage=new count=0, stage=won count=1 total=500000
✅ Timeline CRM: 1 entrée pour l'opportunité
✅ TypeScript tsc --noEmit → 0 erreur
✅ Swagger régénéré
```

### Fichiers Sprint 4 — 27 fichiers, ~2 890 lignes

**Backend (12 fichiers)**
```
backend/database/migrations/2026_08_27_000001_create_companies_table.php
backend/database/migrations/2026_08_27_000002_create_opportunities_table.php
backend/database/migrations/2026_08_27_000003_create_activities_table.php
backend/app/Models/Company.php
backend/app/Models/Opportunity.php
backend/app/Models/Activity.php
backend/app/Models/Prospect.php (modifié)
backend/app/Http/Controllers/Api/CompanyController.php
backend/app/Http/Controllers/Api/OpportunityController.php
backend/app/Http/Controllers/Api/ActivityController.php
backend/database/seeders/PermissionSeeder.php (modifié)
backend/database/seeders/RoleSeeder.php (modifié)
backend/routes/api.php (modifié)
```

**Frontend (15 fichiers)**
```
frontend/src/types/company.ts
frontend/src/types/opportunity.ts
frontend/src/types/activity.ts
frontend/src/api/companies.api.ts
frontend/src/api/opportunities.api.ts
frontend/src/api/activities.api.ts
frontend/src/pages/opportunities/OpportunityKanbanPage.tsx
frontend/src/pages/opportunities/OpportunityDetailPage.tsx
frontend/src/pages/companies/CompanyListPage.tsx
frontend/src/pages/clients/ClientDetailPage.tsx (modifié)
frontend/src/router/index.tsx (modifié)
frontend/src/components/layout/navItems.ts (modifié)
frontend/src/i18n/locales/fr.ts (modifié)
frontend/src/i18n/locales/en.ts (modifié)
```

---

## Sprint 5 — Billing & Finance avancé

**Statut** : ⏳ **Non démarré**

### Tâches prévues (d'après le Playbook)

| Tâche | Description | Estimation |
|-------|-------------|------------|
| **B5.1** | Factures avancées : devis → facture, retours (avoirs), versements partiels, multi-paiements | 4 jours |
| **B5.2** | Comptabilité analytique : budgets par agence/département, rapprochement bancaire, lettrage | 4 jours |
| **B5.3** | Reporting avancé : dashboards interactifs (Chart.js/Recharts), exports PDF, KPIs temps réel | 3 jours |
| **QA-B5** | Tests d'intégration : facture → paiement → écriture comptable → bilan | 1 jour |

### Ce qui manque pour démarrer

- Aucun code Sprint 5 n'a été écrit
- Les tables `budgets`, `bank_reconciliations`, `report_widgets` n'existent pas encore
- Les endpoints `/reports/pdf`, `/reports/dashboard` ne sont pas définis
- La configuration Chart.js/Recharts n'est pas installée côté frontend

---

## État de la base de données

| Table | Sprint | Statut |
|-------|--------|--------|
| `organizations` | Sprint 1 | ✅ |
| `agencies` | Sprint 1 | ✅ |
| `departments` | Sprint 1 | ✅ |
| `countries` / `cities` | Sprint 1 | ✅ |
| `users` (avec lifecycle) | Sprint 1 | ✅ |
| `prospects` (+ company_id) | Sprint 1 + 4 | ✅ |
| `commercials` / `commercial_points` | Sprint 1 | ✅ |
| `client_categories` | Sprint 1 | ✅ |
| `invoices` / `payments` | Sprint 2 | ✅ |
| `treasury_accounts` / `treasury_transactions` | Sprint 2 | ✅ |
| `accounting_transactions` / `accounting_categories` | Sprint 2 | ✅ |
| `expenses` | Sprint 3 | ✅ |
| `commission_rules` / `commission_entries` | Sprint 3 | ✅ |
| `companies` | Sprint 4 | ✅ |
| `opportunities` | Sprint 4 | ✅ |
| `activities` | Sprint 4 | ✅ |
| `budgets` | Sprint 5 | ❌ |
| `bank_reconciliations` | Sprint 5 | ❌ |

---

## État des permissions

**Total permissions** : 22 entités × actions = ~130 permissions

**Entités CRM ajoutées** :
- `entreprises` : consulter, créer, modifier, supprimer, exporter
- `opportunites` : consulter, créer, modifier, supprimer, exporter
- `activites` : consulter, créer, modifier, supprimer

**Entités Finance ajoutées** :
- `depenses` : consulter, créer, modifier, supprimer, valider, encaisser, exporter
- `commissions` : consulter, créer, modifier, supprimer, valider, encaisser, exporter

---

## API Endpoints — État complet

### Sprint 3 (18 endpoints)
```
GET    /expenses                     → ExpenseController@index
POST   /expenses                     → ExpenseController@store
GET    /expenses/{id}                → ExpenseController@show
PUT    /expenses/{id}                → ExpenseController@update
DELETE /expenses/{id}                → ExpenseController@destroy
POST   /expenses/{id}/submit         → ExpenseController@submit
POST   /expenses/{id}/approve        → ExpenseController@approve
POST   /expenses/{id}/reject         → ExpenseController@reject
POST   /expenses/{id}/pay            → ExpenseController@pay
POST   /expenses/{id}/close          → ExpenseController@close
POST   /expenses/{id}/reopen         → ExpenseController@reopen

GET    /commission-rules             → CommissionController@indexRules
POST   /commission-rules             → CommissionController@storeRule
PUT    /commission-rules/{id}        → CommissionController@updateRule
GET    /commission-rules/{id}/versions → CommissionController@ruleVersions
DELETE /commission-rules/{id}        → CommissionController@destroyRule
GET    /commissions/entries          → CommissionController@indexEntries
POST   /commissions/entries/{id}/validate → CommissionController@validateEntry
POST   /commissions/entries/{id}/pay     → CommissionController@payEntry
POST   /commissions/entries/{id}/cancel  → CommissionController@cancelEntry
```

### Sprint 4 (19 endpoints)
```
GET    /companies                    → CompanyController@index
POST   /companies                    → CompanyController@store
GET    /companies/search             → CompanyController@search
GET    /companies/{id}               → CompanyController@show
PUT    /companies/{id}               → CompanyController@update
DELETE /companies/{id}               → CompanyController@destroy

GET    /opportunities                → OpportunityController@index
POST   /opportunities                → OpportunityController@store
GET    /opportunities/pipeline       → OpportunityController@pipeline
GET    /opportunities/{id}           → OpportunityController@show
PUT    /opportunities/{id}           → OpportunityController@update
POST   /opportunities/{id}/stage     → OpportunityController@changeStage
DELETE /opportunities/{id}           → OpportunityController@destroy

GET    /activities                   → ActivityController@index
POST   /activities                   → ActivityController@store
GET    /activities/{id}              → ActivityController@show
PUT    /activities/{id}              → ActivityController@update
POST   /activities/{id}/complete     → ActivityController@complete
DELETE /activities/{id}              → ActivityController@destroy
GET    /crm/timeline                 → ActivityController@timeline
```

---

*Rapport généré automatiquement le 25 août 2026*
