# PEKEGNO — Spécifications des évolutions (Phase 4)

> Document de référence backend + frontend. Il décrit **quoi** faire et **où** dans le code.
> Le document de tâches exécutable correspondant est `TODOLIST_EVOLUTIONS.pdf` (source `TODOLIST_EVOLUTIONS.tex`).

---

## Sommaire

1. [Conventions communes](#1-conventions-communes)
2. [Bug : recherche de factures + filtre par client](#2-bug--recherche-de-factures--filtre-par-client)
3. [Menu Employés](#3-menu-employés)
4. [Paiement en tranches (max 3) + historique des versements](#4-paiement-en-tranches-max-3--historique-des-versements)
5. [Primes à l'encaissement (par tranche) + prime fixe par service](#5-primes-à-lencaissement-par-tranche--prime-fixe-par-service)
6. [Comptabilité (reporting global + par agence)](#6-comptabilité-reporting-global--par-agence)
7. [Reporting commerciaux](#7-reporting-commerciaux)
8. [Abonnements](#8-abonnements)
9. [Catégorie Séminaire (Pass Classique / Premium / VIP)](#9-catégorie-séminaire-pass-classique--premium--vip)
10. [Bilan du jour](#10-bilan-du-jour)
11. [Ordre de mise en œuvre et tests](#11-ordre-de-mise-en-œuvre-et-tests)

---

## 1. Conventions communes

### Stack
- **Backend** : Laravel (PHP 8.x) — `backend/`. Authentification Sanctum, permissions par rôle (`Role` / `Permission`), contrôleurs dans `backend/app/Http/Controllers/Api/`, services dans `backend/app/Services/`, modèles dans `backend/app/Models/`.
- **Frontend** : React 19 + TypeScript + Vite + Tailwind 4 — `frontend/src/`. Routage centralisé dans `frontend/src/router/index.tsx`, navigation dans `frontend/src/components/layout/navItems.ts`, API par module dans `frontend/src/api/*.api.ts`, i18n dans `frontend/src/i18n/locales/fr.ts` et `en.ts`.

### Règles à respecter pour toute nouvelle fonctionnalité
1. **Migrations** : créer les migrations dans `backend/database/migrations/` (préfixe date + numéro séquentiel, ex. `2026_08_15_000001_*`). UUID primaire (`$table->uuid('id')->primary()`), `HasUuids` sur les modèles, `softDeletes` si archivage.
2. **Permissions** : chaque action a sa permission `X.consulter / X.creer / X.modifier / X.supprimer / X.exporter`. Les nouvelles permissions sont ajoutées via seeder (`backend/database/seeders/RoleSeeder.php`) et affectées aux rôles : `super-admin`, `direction-generale`, `responsable-agence`, `comptable`, `caissier`.
3. **Contrôle d'accès** : le frontend duplique la logique via `frontend/src/utils/exportPermissions.ts`, `agencyPermissions.ts`, `employeeRoles.ts`.
4. **i18n** : toutes les chaînes visibles passent par `t('...')` avec clés ajoutées **dans les deux** locales (`fr.ts`, `en.ts`).
5. **Exports Excel** : actuellement tous les exports sont **CSV** (`backend/app/Http/Controllers/Api/ExportController.php`, méthode privée `stream()` + `csvLine()`). Pour l'Excel réel, deux options — la recommandée est en **PhpSpreadsheet** (`maatwebsite/excel` en wrapper Laravel), fichier réel `.xlsx` ; les nouveaux endpoints d'export doivent renvoyer un vrai `.xlsx`. Le frontend réutilise le mécanisme blob de `frontend/src/api/exports.api.ts` (`downloadExport(kind)`) en ajoutant les nouveaux `kind` et extensions `.xlsx`.
6. **Permissions menu** : ajouter les entrées de menu dans `frontend/src/components/layout/navItems.ts` (fonction `getMainItems`) et le sous-menu d'agence dans `frontend/src/components/agencies/AgencyLayout.tsx` (fonction `getSubItems`), avec les routes correspondantes dans `frontend/src/router/index.tsx`.

---

## 2. Bug : recherche de factures + filtre par client

### Constat
Sur la liste des factures, la recherche génère une erreur SQL :
```
SQLSTATE[42703]: Undefined column: 7 ERROR: column "client_name" does not exist
... where ("number"::text like %pk% or "client_name"::text like %pk%)
```
Cause : `backend/app/Http/Controllers/Api/InvoiceController.php` (`index()`, lignes 50-54) recherche sur `invoices.client_name`, or la migration `2026_08_14_000001_add_client_name_to_invoices.php` (qui ajoute cette colonne) **n'a pas été exécutée** sur la base cible.

### Backend
1. Exécuter la migration manquante sur la base : `php artisan migrate` (vérifier `php artisan migrate:status`).
2. **Renforcer le code** pour que la recherche ne dépende plus uniquement de cette colonne : étendre la clause `orWhere` avec une recherche sur la relation client :
   ```php
   $q->where('number', 'like', "%{$s}%")
     ->orWhere('client_name', 'like', "%{$s}%")
     ->orWhereHas('client', fn ($c) => $c->where('first_name', 'like', "%{$s}%")
        ->orWhere('last_name', 'like', "%{$s}%")
        ->orWhere('email', 'like', "%{$s}%"));
   ```
   (`backend/app/Http/Controllers/Api/InvoiceController.php` lignes 51-54). Le paramètre `client_id` existe déjà (ligne 57) — il est utilisé par le filtre.
3. Optionnel : index MySQL/Postgres `client_name` (utile en volume).

### Frontend
La page `frontend/src/pages/invoices/InvoiceListPage.tsx` lit déjà `client_id` depuis l'URL (ligne 61) et le transmet à l'API (ligne 78), mais **aucun champ UI** ne permet de le choisir. Ajouter :
- Un `Select` « Client » dans la barre de filtres (lignes 162-193), alimenté par `clientsApi.list()` (ou `search`), qui écrit `setFilter('client_id', value)`.
- Nouvelle clé i18n `invoices.filterClient`.

---

## 3. Menu Employés

### Besoin
Un employé (ex. un caissier, un agent de terrain) **n'est pas un commercial** mais peut : être lié à un compte utilisateur, vendre un service à un client et être commissionné (primes/points) comme un commercial. On veut un menu **« Employés »** dédié, distinct du menu « Commerciaux », à l'échelle globale et dans chaque agence.

### Conception recommandée (discriminateur)
Réutiliser l'infrastructure commerciale existante pour éviter de dupliquer toute la logique de primes/points. Ajouter une colonne `kind` à `commercials` :

**Migration** `2026_08_15_000002_add_kind_to_commercials_table.php`
```php
Schema::table('commercials', function (Blueprint $table) {
    $table->enum('kind', ['commercial', 'employe'])->default('commercial')->after('agency_id');
});
```

**Alternative** (si séparation stricte souhaitée) : table `employees` copie de `commercials` + nouvelle logique de points dupliquée. Non recommandée : doubler `PointsService`, `CommercialController`.

### Backend
1. `backend/app/Models/Commercial.php` :
   - ajouter `'kind'` au `$fillable` ;
   - scope `scopeKind(Builder $q, string $kind)`.
2. `backend/app/Http/Controllers/Api/CommercialController.php` :
   - `index()` : accepter un paramètre `kind` (`commercial` | `employe`) pour filtrer ;
   - les routes restent identiques (mêmes méthodes de création/modification/points/ranking/stats).
3. Routes (`backend/routes/api.php`) : ajouter
   ```php
   Route::get('/employees', [CommercialController::class, 'index'])->middleware('permission:commercials.consulter');
   // + idem search, available-users, ranking, stats, points, store, show, update, destroy
   ```
   ou un alias `employees` → mêmes contrôleurs. Un seul jeu de contrôleurs, deux URL (menu).
4. Permissions : nouvelles permissions `employes.consulter / creer / modifier / supprimer / exporter` (seeder `RoleSeeder.php`), affectées aux rôles concernés (admin, direction, responsable-agence, comptable).
5. `backend/app/Http/Controllers/Api/ExportController.php` : méthode `employees()` (CSV/XLSX) — même gabarit que `commercials()` (lignes 202-226) + colonne `kind`.
6. Lié aux §4 et §5 : un employé lié à un compte utilisateur (ex. rôle `caissier`) encaisse une facture → les primes de la facture vont au commercial/employé désigné sur la facture (`invoices.commercial_id`), pas à l'utilisateur qui encaisse (les deux notions sont déjà distinctes dans le schéma : `commercial_id` vs `seller_user_id`).

### Frontend
1. Types : `frontend/src/types/commercial.ts` — ajouter `kind?: 'commercial' | 'employe'` à `Commercial`, `CommercialListParams` (champ `kind`), `CommercialPayload`.
2. API : `frontend/src/api/commercials.api.ts` — `list` accepte `kind` ; ajouter `employees.api.ts` (alias) ou param `kind` passé par les pages.
3. Pages `frontend/src/pages/commercials/CommercialListPage.tsx` et `CommercialDetailPage.tsx` : rendre le composant réutilisable avec une prop `kind` (comme le pattern `fixedAgencyId`) pour afficher « Employés » ou « Commerciaux » (titres i18n).
4. Routes (`frontend/src/router/index.tsx`) :
   - `/employees` → liste employés ;
   - `/employees/:id` → détail employé ;
   - `/agencies/:agencyId/employees` et `/agencies/:agencyId/employees/:employeeId` → pages agence-scopées (pattern des wrappers existants dans `frontend/src/pages/commercials/AgencyCommercialsPage.tsx`).
5. Nav (`frontend/src/components/layout/navItems.ts`) : entrée `nav.employees` (icône `UserCog` ou similaire) pour admin/direction/responsable-agence/comptable. Sous-menu agence (`frontend/src/components/agencies/AgencyLayout.tsx`) : entrée `employees`.
6. i18n : clés `nav.employees`, `employees.title`, `employees.subtitle`, colonnes, titres CRUD (fr + en).

---

## 4. Paiement en tranches (max 3) + historique des versements

### Besoin
- Un service peut être payé en **trois tranches maximum**.
- Sur la page détail de la facture, afficher **chaque versement** avec **sa date** à chaque encaissement (l'utilisateur veut « voir les versements pour payer complétement une facture »).

### Backend
1. **Contrainte de tranches** dans `backend/app/Http/Controllers/Api/InvoiceController.php` → `pay()` (lignes 245-294) :
   ```php
   $paymentCount = $invoice->payments()->count();
   abort_if($paymentCount >= 3, 422, 'Paiement en tranches limité à 3 (3 versements maximum).');
   ```
   **Décision actée** : pas de plan de tranches obligatoire — simple plafond de **3 paiements par facture** (avance comprise : elle compte comme 1er versement). Appliquer la même contrainte dans `applyPayment()` (lignes 321-344) pour l'avance à la création.
2. **Historique des versements** : la relation `payments()` et le chargement `payments` existent déjà (`Invoice::show` ligne 196, `InvoicePayment` avec `paid_at`, `received_by`, `comment`). Aucun changement backend nécessaire pour l'affichage ; vérifier que `show()` retourne bien `payments` ordonnés par `paid_at`.
3. **Export comptable** : chaque versement sera journalisé en entrée (voir §6).

### Frontend
1. `frontend/src/pages/invoices/InvoiceDetailPage.tsx` :
   - ajouter un **tableau « Historique des paiements / Versements »** listant pour chaque `invoice.payments` : montant, méthode (`cash`/`mobile`), type (avance/versement), **date de l'encaissement**, encaissé par (receiver), commentaire ;
   - les clés i18n existantes (`invoices.paymentHistory`, `paymentAmount`, `paymentMethod`, `paymentDate`, `paymentReceivedBy`, `paymentIsAdvance`) sont déjà dans `fr.ts` (lignes 992-998) mais inutilisées — les exploiter.
2. Modal d'encaissement (`InvoiceDetailPage.tsx`, modal « Encaisser » lignes 416-470) : bloquer au-delà de 3 paiements (message i18n), et optionnellement saisir la date de l'encaissement (déjà supporté par le payload `paid_at`).

---

## 5. Primes à l'encaissement (par tranche) + prime fixe par service

### Besoin (changement de règle métier)
Actuellement (`InvoiceController::pay()`, lignes 273-283, et `applyPayment()`, lignes 335-343) la prime/commission n'est calculée **qu'au paiement intégral** (`status === 'paid'`) sur le **total** de la facture. Nouvelle règle : **chaque encaissement déclenche la prime proportionnelle au montant encaissé**.

Exemple : service à 1 500 F, payé en 3×500 F → commission calculée sur les 500 F de la tranche 1, puis les 500 F de la tranche 2, puis les 500 F de la tranche 3.

### Prise de commission (commission_type / commission_value du commercial)
- **Pourcentage** : commission(tranche) = `commission_value % × montant_encaissé`.
- **Fixe** : commission(tranche) = `commission_value × (montant_encaissé / total_facture)` (prorata) — la prime fixe n'est atteinte intégralement qu'au paiement complet.

### Prime fixe par service (règle « on s'en fout du pourcentage »)
Si un service a une prime fixe établie à l'avance, c'est **elle** qui prime, quel que soit le pourcentage du commercial.

**Migration** `2026_08_15_000003_add_bonus_fixed_to_services_table.php`
```php
Schema::table('services', function (Blueprint $table) {
    $table->decimal('bonus_fixed', 12, 2)->nullable(); // prime fixe par service vendu
});
```
Calcul : commission(tranche) = `bonus_fixed × (montant_encaissé / total_facture)` si `services.bonus_fixed` défini, sinon règle du commercial.

### Backend
1. **Nouvelle table `commission_payments`** (journal des commissions par encaissement) :
   ```php
   Schema::create('commission_payments', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->foreignUuid('commercial_id')->constrained()->cascadeOnDelete();
       $table->foreignUuid('invoice_id')->constrained()->cascadeOnDelete();
       $table->foreignUuid('payment_id')->nullable()->constrained('invoice_payments')->nullOnDelete();
       $table->foreignUuid('service_id')->nullable()->constrained()->nullOnDelete();
       $table->decimal('amount', 12, 2);              // montant de la commission versée
       $table->decimal('base_amount', 12, 2);         // montant encaissé (base de calcul)
       $table->string('rule');                        // 'percent' | 'fixed' | 'service_fixed'
       $table->decimal('rate', 12, 2)->nullable();    // % ou valeur fixe (snapshot)
       $table->decimal('invoice_total', 12, 2);       // total facture (pour prorata)
       $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
       $table->timestamps();
   });
   ```
2. **Modèle** `backend/app/Models/CommissionPayment.php` (+ relations sur `Commercial`, `Invoice`, `InvoicePayment`).
3. **Service de calcul** `backend/app/Services/CommissionService.php` :
   - `calculateForPayment(Invoice $invoice, float $paidAmount): array` → itère sur les lignes de facture. **Décision actée (multi-lignes)** : chaque ligne reçoit une part du paiement proportionnelle à son poids (`line_total / invoice_total`) ; les lignes dont le service a un `bonus_fixed` non nul sont calculées **à part** — prime fixe proratée : `bonus_fixed × (paidAmount / invoice_total)` — les autres lignes suivent la règle du commercial sur leur part du paiement ;
   - `recordForPayment(...)` : écrit la/les lignes `CommissionPayment` (une par ligne calculée, rattachées au même `payment_id`) + log activité.
4. **Modification de `InvoiceController`** :
   - `pay()` (lignes 273-283) et `applyPayment()` (lignes 335-343) : remplacer l'appel au moment « paid » par `CommissionService->recordForPayment()` **à chaque encaissement** (avec idempotence : une seule ligne par `payment_id`).
   - **Décision actée** : `commission_amount` est **conservé comme agrégat** — incrémenté à chaque encaissement de la somme des commissions versées (`commission_payments`) — pour ne pas casser les statistiques existantes ; `commission_payments` reste le journal de détail.
   - **Décision actée** : points **inchangés** — `PointsService::awardForSale` (idempotent via `points_awarded`) reste déclenché au paiement intégral (au soldé) ; seules les commissions monétaires sont versées par tranche.
5. `Invoice::show` : charger `commissionPayments` si le frontend doit les afficher.

### Frontend
1. Types : `frontend/src/types/commercial.ts` — ajouter `CommissionPayment` ; `frontend/src/types/invoice.ts` — relation optionnelle `commission_payments?` sur `Invoice` ; `Service.bonus_fixed?`.
2. Page détail commercial/employé : section « Commissions versées » (somme, détail par facture/tranche) — alimenter `CommercialStats` (`backend .../CommercialController::stats`) avec `commissions` par tranche.
3. Formulaire service (`frontend/src/components/services/ServiceFormModal.tsx`) : champ « Prime fixe (optionnel) » → `bonus_fixed`.
4. Affichage prime fixe dans les cartes services (badge) — `ServiceListPage.tsx`.
5. i18n : clés `services.bonusFixed`, `invoices.commissionPerTranche`, `commercials.commissionsHistory`, etc.

---

## 6. Comptabilité (reporting global + par agence)

### Besoin
Un menu **« Comptabilité »** sur le dashboard principal : reporting complet de **toutes les agences**, filtrable, exportable **Excel**, avec des transactions de deux types (**entrées / sorties**) catégorisées (catégories créables). **Toute entrée d'argent dans PEKEGNO y est journalisée** (y compris chaque enregistrement de facture et chaque paiement de tranche). Un menu « Comptabilité » **par agence** n'affiche que les entrées/sorties de l'agence.

### Champs du tableau
| N° | Agence | Rubrique | Montant | Client | Date | Type | Opérateur | Objet | Bénéficiaire | Justification |
|----|--------|----------|---------|--------|------|------|-----------|-------|--------------|---------------|
| auto (incrément) | nom | nom de l'entrée/sortie ou **n° de facture** si entrée issue d'un encaissement | montant | client | date | entrée/sortie | celui qui encaisse/enregistre | commentaire | (surtout sorties) à qui on a donné l'argent | (toujours pour les sorties) |

### Backend
1. **Migration** `2026_08_15_000004_create_accounting_tables.php`
   ```php
   // Catégories
   Schema::create('accounting_categories', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->string('name');
       $table->enum('type', ['income', 'expense']);
       $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete(); // null = catégorie globale
       $table->boolean('is_system')->default(false);
       $table->timestamps();
   });

   // Transactions
   Schema::create('accounting_transactions', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->unsignedBigInteger('number')->autoIncrement(); // N°
       $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
       $table->foreignUuid('category_id')->nullable()->constrained('accounting_categories')->nullOnDelete();
       $table->enum('type', ['income', 'expense']);
       $table->string('label');                 // Rubrique
       $table->string('reference')->nullable(); // n° facture pour les entrées issues d'un encaissement
       $table->decimal('amount', 12, 2);
       $table->foreignUuid('client_id')->nullable()->constrained('users')->nullOnDelete();
       $table->foreignUuid('invoice_id')->nullable()->constrained()->nullOnDelete();
       $table->dateTime('transacted_at');
       $table->foreignUuid('operator_id')->nullable()->constrained('users')->nullOnDelete();
       $table->string('note')->nullable();                 // Objet
       $table->string('beneficiary')->nullable();          // Bénéficiaire (sorties)
       $table->string('justification')->nullable();        // Justification (sorties)
       $table->timestamps();
       $table->index(['agency_id', 'transacted_at', 'type']);
   });
   ```
2. **Journalisation automatique** :
   - Dans `InvoiceController::pay()` et `applyPayment()` : après insertion d'un `invoice_payments`, créer une transaction `income` : `label = "Facture {number} — versement"`, `reference = invoice.number`, `client_id`, `amount`, `transacted_at = paid_at`, `operator_id = received_by`.
   - Création de facture avec avance : idem (l'avance est un versement).
   - **Décision actée** : une facture annulée ne génère **aucune** écriture comptable (seuls les flux réels sont tracés).
   - **Modèles** `AccountingTransaction`, `AccountingCategory` + relations.
3. **Contrôleurs** :
   - `backend/app/Http/Controllers/Api/AccountingController.php` :
     - `index(Request)` : filtres `agency_id`, `type`, `category_id`, `client_id`, `from`, `to`, `search` (label/reference), pagination + totaux (entrées / sorties / solde) ;
     - `store(Request)` : création manuelle (entrée ou sortie), validation type + montant + (si sortie) `beneficiary` et `justification` requis ;
     - `update`, `destroy` (avec protection des transactions système générées automatiquement — ne pas pouvoir supprimer un enregistrement de facture par erreur ; `is_system`/auto) ;
     - `categories()` : CRUD des catégories.
   - `ExportController` : méthode `accounting(Request)` → export Excel des transactions selon les mêmes filtres.
4. **Routes** (`backend/routes/api.php`) :
   ```php
   Route::apiResource('accounting/transactions', AccountingController::class)->except(['show']);
   Route::apiResource('accounting/categories', AccountingCategoryController::class);
   Route::get('/exports/accounting', [ExportController::class, 'accounting']);
   ```
   avec permissions `comptabilite.consulter / creer / modifier / supprimer / exporter`.
5. **Permissions/seeders** : nouvelles permissions `comptabilite.*` et `accounting-categories.*` ; rôles : `super-admin`, `direction-generale`, `responsable-agence` (agence), `comptable` (global), `caissier` (lecture agence uniquement, si souhaité).

### Frontend
1. **Types** `frontend/src/types/accounting.ts` : `AccountingTransaction`, `AccountingCategory`, `AccountingListParams`, `AccountingTotals`.
2. **API** `frontend/src/api/accounting.api.ts` : `list`, `create`, `update`, `remove`, `categories.list/create/update/remove`, export.
3. **Pages** :
   - `frontend/src/pages/accounting/AccountingPage.tsx` (global, toutes agences) avec filtres (agence, type, catégorie, client, dates, recherche) + totaux + export Excel + modales CRUD (entrée/sortie) + gestion des catégories.
   - `frontend/src/pages/accounting/AgencyAccountingPage.tsx` : wrapper avec `fixedAgencyId` (pattern `AgencyInvoicesPage`).
4. **Routes** : `/accounting` (global) et `/agencies/:agencyId/accounting`.
5. **Nav** : `nav.accounting` dans `navItems.ts` (admin, direction, comptable ; agence-scopé pour responsable-agence via `/accounting?agency_id=...`) ; sous-menu agence dans `AgencyLayout.tsx` (`getSubItems`).
6. **Export** : ajouter `'accounting'` à `ExportKind` dans `frontend/src/api/exports.api.ts` et un bouton « Exporter Excel » dans la page.
7. **i18n** : bloc `accounting.*` complet (fr/en) : colonnes, types, catégories, modales, messages.

---

## 7. Reporting commerciaux

### Besoin
Reporting complet dédié aux commerciaux (et employés), filtrable et **exportable Excel**.

### Backend
1. **Endpoint agrégé** `backend/app/Http/Controllers/Api/StatsController.php` (ou nouveau `CommercialReportController`) :
   - `report(Request)` avec filtres : `agency_id`, `commercial_id`, `from`, `to`.
   - Sortie : par commercial/employé — nombre de ventes, CA facturé, CA encaissé, nombre de tranches, **commissions par tranche** (depuis `commission_payments`), points gagnés, prospects créés, taux de conversion prospect→client.
   - Totaux globaux + classement.
2. **Export** : `ExportController::commercialReport(Request)` → Excel (même filtres), ou paramètre `export=1` sur le même endpoint renvoyant un fichier.
3. **Permissions** : `commerciaux.reporting` (consulter/exporter) affectée à `super-admin`, `direction-generale`, `responsable-agence`, `comptable`.

### Frontend
1. Page `frontend/src/pages/commercials/CommercialReportPage.tsx` : filtres (agence, commercial, période), tableaux (résumé, détail par vente/tranche, points, prospects), totaux, export Excel.
2. Route `/commercials/report`.
3. Nav : lien depuis `navItems.ts` (menu Commercials) ou sous-menu ; bouton « Reporting » sur `CommercialListPage`.
4. i18n : bloc `commercials.report.*`.

---

## 8. Abonnements

### Besoin
Dans le menu des agences : un menu **« Abonnement »** = un **pack de services** avec un prix saisi à la création du pack. On part du principe de **4 services différents** par pack. La facture d'abonnement pour un client est de la forme : **Nom, durée, prix par mois, nombre de mois achetés, prix total**. Un abonnement peut être **renouvelé**, et un renouvellement **crée une nouvelle facture**.

### Backend
1. **Migrations** `2026_08_15_000005_create_subscription_tables.php`
   ```php
   // Packs
   Schema::create('subscription_packs', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->foreignUuid('agency_id')->constrained()->cascadeOnDelete();
       $table->string('name');
       $table->text('description')->nullable();
       $table->boolean('is_active')->default(true);
       $table->timestamps();
   });

   // Services du pack (4 services par pack — règle métier)
   Schema::create('subscription_pack_services', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->foreignUuid('subscription_pack_id')->constrained()->cascadeOnDelete();
       $table->foreignUuid('service_id')->constrained()->cascadeOnDelete();
       $table->decimal('price_per_month', 12, 2);
       $table->timestamps();
   });

   // Abonnements (contrats)
   Schema::create('subscriptions', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->foreignUuid('subscription_pack_id')->constrained()->cascadeOnDelete();
       $table->foreignUuid('agency_id')->constrained()->cascadeOnDelete();
       $table->foreignUuid('client_id')->constrained('users')->cascadeOnDelete();
       $table->integer('months');
       $table->decimal('price_per_month', 12, 2);
       $table->decimal('total_price', 12, 2);   // price_per_month × months (somme des services du pack)
       $table->date('start_date');
       $table->date('end_date');
       $table->foreignUuid('invoice_id')->nullable()->constrained()->nullOnDelete();
       $table->timestamps();
   });
   ```
2. **Modèles** : `SubscriptionPack`, `SubscriptionPackService`, `Subscription` + relations.
3. **Contrôleur** `backend/app/Http/Controllers/Api/SubscriptionController.php` :
   - `packs` : CRUD pack (avec ses 4 services et prix/mois de chaque service) ;
   - `store` : créer un abonnement → **génère automatiquement une facture** (réutiliser `InvoiceNumberGenerator` et la logique de `InvoiceController::store` avec des lignes « service pack × mois ») et renvoie l'abonnement + la facture ;
   - `renew` : **crée une nouvelle facture** pour la période suivante (nouvelle ligne de temps) ;
   - `index/show` avec filtres agence/client/statut.
4. **Routes** :
   ```php
   Route::apiResource('subscription-packs', ...)->except(['show']);
   Route::apiResource('subscriptions', ...);
   Route::post('/subscriptions/{subscription}/renew', [SubscriptionController::class, 'renew']);
   ```
   Permissions `abonnements.*`.
5. **Journalisation comptable** : la création d'un abonnement avec encaissement → entrée comptable (cf. §6).

### Frontend
1. Types `frontend/src/types/subscription.ts`, API `frontend/src/api/subscriptions.api.ts`.
2. Pages (sous-menu agence) :
   - `frontend/src/pages/subscriptions/AgencySubscriptionsPage.tsx` : liste des packs + création de pack (4 services, prix/mois) + liste des abonnements + création d'abonnement (pack, client, nombre de mois) + bouton « Renouveler » ;
   - lien vers la facture générée (`/agencies/:id/invoices/:invoiceId`).
3. Routes : `/agencies/:agencyId/subscriptions` (+ éventuellement global `/subscriptions` pour admin).
4. Nav : entrée `nav.subscriptions` dans le sous-menu agence (`AgencyLayout.tsx`) et menu global admin.
5. i18n : bloc `subscriptions.*` (nom, durée, prix/mois, nb mois, prix total, renouveler, etc.).

---

## 9. Catégorie Séminaire (Pass Classique / Premium / VIP)

### Besoin
Dans le catalogue, une catégorie **« Séminaire »** est spéciale : son prix **varie selon le Pass** choisi : **Classique**, **Premium**, **VIP**. Les prix des passes doivent pouvoir être définis « intelligemment » depuis l'app.

### Conception recommandée
1. **Catégorie** « Séminaire » : créée par seeder dans `backend/database/seeders/CategorySeeder.php` (ou catalogue) ; un service est « séminaire » si sa catégorie s'appelle `Séminaire` (`is_seminar` sur le service pour robustesse).
2. **Table des passes** :
   ```php
   Schema::create('seminar_tiers', function (Blueprint $table) {
       $table->uuid('id')->primary();
       $table->foreignUuid('service_id')->constrained()->cascadeOnDelete();
       $table->enum('tier', ['classique', 'premium', 'vip']);
       $table->string('label');            // ex. "Pass Classique"
       $table->decimal('price', 12, 2);
       $table->string('description')->nullable();
       $table->timestamps();
       $table->unique(['service_id', 'tier']);
   });
   ```
   Règle « intelligente » : à la création d'un service séminaire, prix des passes dérivés du prix de base (`price`) — ex. Classique = prix, Premium = ×1.5, VIP = ×2.5 — **modifiables** dans le formulaire service.
3. **Vente** : sur le formulaire de facture / vente rapide, si la ligne est un service séminaire, l'utilisateur choisit le **Pass** → `unit_price` = prix du pass (écrire `pass_tier` + `pass_label` sur la ligne de facture pour trace).
   - Migration `invoice_items` : `string('pass_tier')->nullable()`.

### Backend
- `backend/app/Models/Service.php` : relation `seminarTiers()`, accesseur `is_seminar`.
- `ServiceController` : CRUD des tiers (imbriqué au formulaire service).
- `InvoiceController::store()` : accepter `pass_tier` par ligne ; résoudre le prix depuis `seminar_tiers`.

### Frontend
- `frontend/src/components/services/ServiceFormModal.tsx` : si catégorie « Séminaire », afficher 3 champs de prix (Classique/Premium/VIP).
- `InvoiceFormPage.tsx` / `QuickSalePage.tsx` : `Select` « Pass » sur les lignes de service séminaire.
- Types : `InvoiceLinePayload` + `pass_tier` ; `Service` + `seminar_tiers`.
- i18n : `services.seminar.*`, `invoices.passLabel`.

---

## 10. Bilan du jour

### Besoin
Menu **« Bilan du jour »** exportable Excel. Exemple sur un mois : pour chaque service, **nombre total vendu** et **somme totale** ; puis **total de tous les services vendus** ; on note le **montant reçu en cash** et en **mobile money** (cash + mobile = total services vendus) ; un **solde initial** (argent en caisse au début de la journée — le total encaissé du jour X devient le solde initial du jour X+1) ; une **dépense du jour** (référence aux sorties comptables §6) ; enfin un **solde final = montant total − dépense du jour**. Filtrable par agence, avec menu par agence.

### Backend
1. **Endpoint** `StatsController::dailyBilan(Request)` (ou `BilanController`) :
   - paramètres : `agency_id`, `date` (jour) ;
   - **par service** : `count` et `sum` des `invoice_items` (factures non annulées, `invoice_date` du jour) — pour les séminaires, ventes par pass ;
   - **total services vendus** (somme) ;
   - **encaissements cash / mobile** (somme des `invoice_payments.payment_method` du jour, factures non annulées) ;
   - **dépense du jour** : somme des sorties `accounting_transactions` (type `expense`, `transacted_at` du jour) ;
   - **solde initial** : total encaissé du jour précédent (ou `bilan_solde_initial` stocké — cf. option ci-dessous) ;
   - **solde final** = total encaissé − dépense du jour.
   - Contrôle de cohérence : `cash + mobile == total services vendus` (alerte si écart).
2. **Option stockage** : table `daily_balances` (agency_id, date, solde_initial, solde_final) pour fiabiliser la chaîne solde initial → solde final (le total encaissé du jour X est le solde initial du jour X+1). Recommandé.
3. **Export** : `ExportController::dailyBilan(Request)` → Excel.
4. **Permissions** : `bilans.consulter / exporter` (admin, direction, responsable-agence, caissier agence, comptable).

### Frontend
1. Page `frontend/src/pages/reports/DailyBilanPage.tsx` : sélecteur date + agence, tableau par service (nbre, total), totaux, cash/mobile, solde initial, dépense, solde final, bouton export Excel.
2. Routes : `/bilans` (global) et `/agencies/:agencyId/bilans` ; nav global `nav.dailyBilan` + sous-menu agence.
3. i18n : bloc `bilan.*`.

---

## 11. Ordre de mise en œuvre et tests

### Ordre recommandé
1. **Bug recherche factures** (§2) — rapide, débloque le quotidien.
2. **Prime fixe par service + primes par tranche** (§5) + **tranches** (§4) — socle métier.
3. **Employés** (§3) — dépend du §5 (même modèle).
4. **Comptabilité** (§6) — consomme les paiements du §4.
5. **Bilan du jour** (§10) — consomme §4 + §6.
6. **Abonnements** (§8) et **Séminaire** (§9).
7. **Reporting commerciaux** (§7) — consomme §5.

### Décisions actées
- **Tranches** : pas de plan de tranches obligatoire — simple plafond de **3 paiements par facture** (avance comprise).
- **Primes multi-lignes** : le commercial/employé est primé à **chaque versement** ; les lignes dont le service a une `bonus_fixed` sont calculées **à part** (prime fixe proratée sur le ratio du paiement), les autres avec la règle du commercial.
- **Points commerciaux** : **inchangés** — attribués au paiement intégral (au soldé), pas par tranche.
- **`commission_amount`** : **conservé comme agrégat** (somme des `commission_payments`) pour compatibilité avec les statistiques existantes.
- **Factures annulées** : **aucune** écriture comptable générée.
- **Catégories comptables** : catégories globales + par agence, avec catégories système pré-remplies (ex. « Encaissement facture »).

### Tests à prévoir
- **Backend** (`backend/tests/`) : feature tests pour payer en 3 tranches (max 3, refus au 4e), commission par tranche (percent / fixed / service_fixed), recherche factures (number, client_name, client lié), journalisation comptable automatique (paiement → entrée), abonnement → génération de facture + renouvellement, bilan du jour (cohérence cash+mobile=total).
- **Frontend** : vérification manuelle des pages, des exports Excel (ouverture sans corruption), de l'i18n fr/en.
