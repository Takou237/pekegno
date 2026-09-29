# À faire — Séparation "Site Client" / "Pekegno Management"

Analyse basée sur l'état réel du dépôt (backend Laravel `backend/`, frontend React/Vite `frontend/`) au 2026-09-07.

## 0. Liste des tâches à effectuer (détaillée)

Vue d'ensemble condensée de toutes les tâches, groupées par domaine. Chaque ligne renvoie à la section correspondante pour le détail (fichiers exacts, schéma, etc.).

### 0.1 Base de données (7 tâches — voir section 3)

1. **Ajouter `is_public` + `slug` à `services` et `products`** — permet de choisir quels services/produits internes sont réellement visibles/vendables sur la boutique publique, sans toucher au catalogue interne existant.
2. **Ajouter `cover_image` à `products`** — `services` a déjà une image de couverture, `products` non ; nécessaire pour afficher une vignette produit sur la boutique.
3. **Ajouter `channel` à `orders`** (`in_person` / `commercial_online` / `client_self`) — trace l'origine de la commande pour savoir si un commercial doit être associé ou non, et pour piloter la validation de facture.
4. **Ajouter le workflow de validation à `invoices`** (`validation_status`, `validated_by`, `validated_at`, `rejection_reason`, `source`) — c'est la pièce centrale : sans ce champ, impossible de distinguer une facture "pending" (créée par un client ou un commercial, pas encore vérifiée) d'une facture normale, et donc impossible d'empêcher son entrée en comptabilité tant qu'elle n'est pas validée.
5. **Créer la table `payment_proofs`** — stocke chaque preuve de paiement déposée par un client (fichier, méthode, référence, statut de revue) ; une facture peut recevoir plusieurs tentatives de preuve avant validation.
6. **Créer la table `agency_payment_methods`** — stocke les numéros Orange Money / MTN MoMo par agence, à afficher au client au moment de payer.
7. **Ajouter `course_module_id`, `author_user_id`, `visible_to_client` à `learner_observations`** — aujourd'hui l'observation est au niveau cours/session global ; il faut la rattacher à un module précis et savoir qui l'a écrite (staff ou client lui-même) pour gérer la visibilité.
8. **Seeder la permission `invoices.valider`** pour `caissier` et `direction-generale` — sans cette permission, personne ne peut légitimement valider/rejeter une facture pending.

### 0.2 Backend Laravel (voir section 4)

**API publique (non authentifiée)**
9. **Créer `PublicCatalogController`** (pays, agences, services publics, produits publics, moyens de paiement d'une agence) — c'est le seul point d'entrée qui manque totalement aujourd'hui pour qu'un visiteur anonyme puisse parcourir le catalogue ; actuellement tout est derrière `auth:sanctum`.
10. **Déclarer les routes `/api/public/*`** hors de tout middleware d'authentification.

**Espace client (`portal:client`)**
11. **`ClientOrderController`** — le client voit uniquement ses propres commandes (`client_id` = utilisateur connecté), sans jamais exposer celles des autres clients.
12. **`ClientCheckoutController`** (`POST /api/client/checkout`) — flux "un clic" : le client choisit un produit/service, la commande ET la facture associée sont créées d'un coup, avec `commercial_id = null` (personne ne lui a vendu, il a acheté seul) et `validation_status = pending`.
13. **`ClientInvoiceController`** — liste/détail de ses factures + upload de la preuve de paiement (`payment_proofs`).
14. **`ClientEnrollmentController`** — liste des formations auxquelles le client est inscrit.
15. **`ClientLearnerController`** — sa fiche apprenant (progression par module).
16. **`ClientAttendanceController`** — ses présences, par module et par formation.
17. **`ClientLearnerObservationController`** — consulter les observations le concernant et en ajouter une par module de session (avec vérification qu'il est bien inscrit à cette session avant d'autoriser l'ajout).
18. **Déclarer toutes les routes `/api/client/*`** dans le groupe `portal:client` déjà existant.

**Workflow de validation des factures**
19. **Ajouter `validate()` / `reject()` à `InvoiceController`**, protégés par la permission `invoices.valider` — c'est l'action que la caissière ou le directeur exécute pour faire passer une facture de `pending` à `validated` (ou `rejected`).
20. **Étendre `InvoiceController::index()`** pour filtrer par `validation_status=pending` — nécessaire pour construire la "file d'attente" du caissier.
21. **Bloquer l'entrée en comptabilité tant que `validation_status !== 'validated'`** — modifier `InvoiceController::pay()` et les agrégats de `AccountingController` / `StatsController` / `BilanController` pour qu'ils ignorent les factures pending/rejetées. C'est la règle métier explicitement demandée : *"une facture en pending n'est pas entrée en comptabilité tant qu'elle n'est pas validée"*.
22. **Corriger `OrderController::invoice()`** pour fixer `validation_status`/`source` selon l'origine de la commande (`channel`), au lieu du statut figé actuel.

**Rôle commercial**
23. **Ajouter `GET /api/commercial/me/stats`** (ou vérifier s'il existe déjà) — pour que le commercial voie ses propres statistiques dans son tableau de bord, sans accès aux stats des autres commerciaux.
24. **Restreindre `OrderController::store()`** : un utilisateur avec le rôle `commercial` ne peut créer une commande qu'avec son propre `commercial_id`, jamais celui d'un collègue.
25. **Vérifier que la facture d'une vente commerciale part bien en `pending`** — comme demandé, une vente faite par un commercial doit aussi passer par la validation caissier/directeur, contrairement à une facture créée directement par le caissier lui-même.

**Rôle caissier**
26. **Vérifier/compléter les permissions caissier** (`invoices.creer`, `invoices.encaisser`, + nouvelle `invoices.valider`).

### 0.3 Frontend interne `frontend/` (voir section 5)

27. **Page tableau de bord commercial** (`CommercialSelfDashboardPage.tsx`) — stats perso + accès rapide au catalogue + bouton "Nouvelle vente/inscription".
28. **Page file d'attente factures pending** (`PendingInvoicesPage.tsx`) — liste des factures à valider avec actions Valider/Rejeter, visible seulement pour caissier/direction-generale.
29. **Nouvelles routes** `/commercial/dashboard` et `/invoices/pending` dans `src/router/index.tsx`.
30. **Menu de navigation conditionnel par rôle** — le commercial voit "Mon tableau de bord"/"Catalogue"/"Nouvelle vente", le caissier voit "Factures à valider".
31. **Client API frontend** pour les nouveaux endpoints `validate`/`reject`/filtre `validation_status`.

### 0.4 Nouveau site client (voir section 6)

**Pages publiques**
32. Page d'accueil.
33. Page catalogue avec filtres pays → agence → catégorie.
34. Fiche produit/formation détaillée avec bouton "Commander".
35. Flux de redirection connexion/inscription si le visiteur n'est pas connecté au moment de commander.
36. Écran de paiement (numéro OM/MoMo affiché + formulaire de dépôt de preuve de paiement).
37. Pages connexion / inscription / mot de passe oublié.

**Espace client authentifié**
38. Tableau de bord client (résumé).
39. Mes commandes.
40. Mes factures (avec statut de validation visible et upload de preuve si en attente).
41. Mes formations (inscriptions).
42. Ma fiche apprenant (progression par module, observations, présences).
43. Mon profil.

**Technique**
44. Initialiser le nouveau projet (stack identique à `frontend/` pour cohérence).
45. Client HTTP dédié + gestion de session Sanctum côté client, distincte du staff.
46. Déploiement séparé (nouveau service Render/Vercel).

### 0.5 Ordre de traitement recommandé

DB (0.1) → API publique (9-10) → Workflow validation (19-22) → API espace client (11-18, 23-26) → Site client public + espace client (32-46, en parallèle dès que l'API publique est prête) → Ajouts frontend interne (27-31) → Phase 2 optionnelle (notifications, panier multi-articles, reçu PDF).

---

## 1. Constat (état actuel)

- `frontend/` est **une seule SPA protégée** : tout est derrière `ProtectedRoute` (voir `src/router/index.tsx`), sauf `/login`, `/register`, `/forgot-password`, `/reset-password`, `/two-factor`. Il n'existe **aucune page catalogue/boutique publique**, ni espace client (commandes, factures, formations, fiche apprenant).
- Le backend a déjà de bonnes fondations réutilisables :
  - Auth client déjà séparée du staff via le middleware `portal:client` (`backend/app/Http/Middleware/EnsurePortal.php`), routes `/api/client/login`, `/api/client/register` (en fait `RegisterController` générique), `/api/client/me`.
  - Modèles `Order`/`OrderLine` (`backend/app/Models/Order.php`), `Invoice`/`InvoiceItem`/`InvoicePayment`, `Product`, `Service` (déjà segmentés par `agency_id` nullable = "toutes agences"), `FormationEnrollment`, `Attendance` (déjà par `course_module_id`), `LearnerObservation`.
  - Rôles `commercial` et `caissier` déjà seedés avec permissions (`backend/database/seeders/RoleSeeder.php`, `PermissionSeeder.php`).
- Ce qui **manque totalement** :
  - Toute route API publique (non authentifiée) pour lister produits/formations/agences/pays → tout est derrière `auth:sanctum`.
  - Un flux de commande self-service client (aujourd'hui `OrderController` est pensé pour un usage interne staff : `client_id` requis, mais pas de notion "vente sans commercial").
  - Une notion de **validation de facture** distincte du statut de paiement : `invoices.status` = `unpaid/partial/paid/cancelled` uniquement — pas de `pending validation` qui bloquerait l'entrée en comptabilité.
  - Preuve de paiement (upload + numéro OM/MoMo par agence).
  - Tout endpoint/page côté client pour voir ses commandes, factures, formations, présences, observations par module.
  - Dashboard "commercial" en self-service (stats perso + vente rapide) et file d'attente "factures à valider" pour caissier/directeur.

## 2. Décision d'architecture (à valider)

**Recommandation** : créer une **nouvelle application frontend séparée** (ex. dossier `site-client/`, nouveau Vite React app) pour la boutique publique + espace client, plutôt que d'ajouter des routes publiques dans `frontend/` (qui reste l'outil interne "Pekegno Management" pour admin/agences/commerciaux/caissiers/directeurs).

Pourquoi :
- `frontend/` part du principe que tout visiteur est authentifié (`ProtectedRoute` en racine `/`) — en faire un site public demanderait de réorganiser tout le routing existant.
- Séparation de déploiement (nom de domaine `shop.pekegno.com` vs `app.pekegno.com`), bundle plus léger pour le grand public, branding distinct.
- Les deux apps consomment la **même API Laravel** (`backend/`) : routes publiques nouvelles + routes `portal:client` déjà en place.

Si vous préférez une seule app avec un layout public en plus (moins de duplication de design system, un seul déploiement), le découpage des tâches ci-dessous reste valable : remplacer "nouvelle app" par "nouveau dossier `src/public/` + nouveau layout" dans `frontend/`. Je pars sur l'option "app séparée" pour la suite du document.

---

## 3. Base de données — migrations à créer (`backend/database/migrations/`)

- [ ] **`add_public_flags_to_services_and_products_table.php`**
  Ajouter à `services` et `products` : `is_public` (bool, default false), `slug` (string, unique nullable). Objectif : distinguer les services/produits utilisés en interne (facturation staff) de ceux réellement vendables sur la boutique publique.
  → Modifier `app/Models/Service.php` et `app/Models/Product.php` (fillable + scope `scopePublic`).

- [ ] **`add_cover_image_to_products_table.php`**
  `products` n'a pas d'équivalent de `cover_image`/`presentation_video` (présents sur `services`). Ajouter `cover_image` (string nullable) pour l'affichage boutique.

- [ ] **`add_channel_to_orders_table.php`**
  Ajouter `channel` (enum/string : `in_person`, `commercial_online`, `client_self`) sur `orders`, default `in_person`. Sert à savoir si `commercial_id` doit être exigé (staff/POS) ou peut être `null` (achat direct par le client).
  → `commercial_id` est déjà nullable dans `orders` (`2026_08_21_000009_create_orders_tables.php`), pas de changement de schéma nécessaire là.

- [ ] **`add_validation_workflow_to_invoices_table.php`**
  Ajouter sur `invoices` :
  - `validation_status` (enum/string : `pending`, `validated`, `rejected`, default `validated` pour ne pas casser l'existant — les factures créées en interne restent auto-validées).
  - `validated_by` (uuid nullable, FK `users`).
  - `validated_at` (timestamp nullable).
  - `rejection_reason` (text nullable).
  - `source` (enum/string : `in_person`, `commercial_online`, `client_self`, default `in_person`).
  → Toute facture `source = client_self` ou `commercial_online` naît avec `validation_status = pending`.

- [ ] **`create_payment_proofs_table.php`**
  Nouvelle table `payment_proofs` : `id` (uuid), `invoice_id` (FK), `submitted_by` (FK users, nullable si soumis par le client lui-même = `client_id`), `payment_method` (`orange_money`, `mtn_momo`, `bank_transfer`, `cash`, ...), `phone_number_used` (string nullable), `reference` (string nullable), `file_path` (string), `status` (`pending`, `accepted`, `rejected`, default `pending`), `reviewed_by` (FK users nullable), `reviewed_at` (timestamp nullable), `notes` (text nullable), timestamps.
  → Nouveau modèle `app/Models/PaymentProof.php`, relation `Invoice::hasMany(PaymentProof::class)`.

- [ ] **`create_agency_payment_methods_table.php`**
  Nouvelle table `agency_payment_methods` : `id`, `agency_id` (FK), `provider` (`orange_money`, `mtn_momo`, `bank`, ...), `phone_number` (string nullable), `account_holder` (string nullable), `instructions` (text nullable), `is_active` (bool default true), timestamps.
  → Nouveau modèle `app/Models/AgencyPaymentMethod.php`, relation `Agency::hasMany(AgencyPaymentMethod::class)`. Sert à afficher "Numéro OM/MoMo de l'agence X" sur la fiche produit/paiement.

- [ ] **`add_module_and_author_to_learner_observations_table.php`**
  Sur `learner_observations` : ajouter `course_module_id` (FK nullable vers `course_modules` — actuellement l'observation est au niveau course/session, pas module), `author_user_id` (FK users — qui a écrit l'observation : formateur/staff ou client lui-même), `visible_to_client` (bool default true).
  → Modifier `app/Models/LearnerObservation.php` (relations `courseModule()`, `author()`).

- [ ] **Seed** `database/seeders/PermissionSeeder.php` + `RoleSeeder.php` : ajouter la permission `invoices.valider` (validation factures pending), attribuée aux rôles `caissier` et `direction-generale` (le rôle "directeur" du cahier des charges correspond à `direction-generale` dans `RoleSeeder.php:15`). `super-admin` a de toute façon accès complet.

---

## 4. Backend Laravel — contrôleurs & routes

### 4.1 API publique (aucune authentification), nouveau namespace `App\Http\Controllers\Api\Public`

- [ ] `app/Http/Controllers/Api/Public/PublicCatalogController.php`
  - `countries()` → liste des pays actifs (wrap `Country`).
  - `agencies(Request $request)` → agences filtrées par `country_id`, colonnes publiques uniquement (nom, ville, adresse, téléphone).
  - `services(Request $request)` → `Service::availableIn($agencyId)->where('is_public', true)` avec filtre pays (via `agency.country_id`) et catégorie.
  - `service(Service $service)` → détail + `effective_price` (promo) + sessions de formation à venir si `Course` lié.
  - `products(Request $request)` / `product(Product $product)` → idem sur `Product`.
  - `agencyPaymentMethods(Agency $agency)` → liste des `AgencyPaymentMethod` actifs.
- [ ] Déclarer les routes hors de tout `middleware(['auth:sanctum', ...])`, en tête de `backend/routes/api.php` (section "Public storefront") :
  ```
  Route::prefix('public')->group(function () {
      Route::get('countries', ...);
      Route::get('agencies', ...);
      Route::get('services', ...);
      Route::get('services/{service}', ...);
      Route::get('products', ...);
      Route::get('products/{product}', ...);
      Route::get('agencies/{agency}/payment-methods', ...);
  });
  ```

### 4.2 Espace client (`portal:client`), nouveau namespace `App\Http\Controllers\Api\Client`

- [ ] `Api/Client/ClientOrderController.php` — `index()` (commandes du client connecté uniquement, `where('client_id', $request->user()->id)`), `store()` (crée `Order` avec `client_id = auth()->id()`, `commercial_id = null`, `channel = 'client_self'`), `show(Order $order)` (403 si pas le sien).
- [ ] `Api/Client/ClientCheckoutController.php` — endpoint unique `POST /api/client/checkout` : reçoit `{product_id|service_id, quantity, agency_id}`, crée `Order` (channel `client_self`) + génère directement la `Invoice` associée avec `source = client_self`, `validation_status = pending`, `seller_user_id = null`, `commercial_id = null`. Réutilise la logique de `OrderController::buildLines()`/`invoice()` (à factoriser dans un service partagé, ex. `app/Services/OrderInvoicingService.php`, pour éviter la duplication entre commande staff et commande client).
- [ ] `Api/Client/ClientInvoiceController.php` — `index()`, `show(Invoice $invoice)` (scope au client), `uploadProof(Request $request, Invoice $invoice)` → crée un `PaymentProof` (upload fichier via le disque `public`, comme `UploadController`) et laisse `invoice.validation_status` à `pending`.
- [ ] `Api/Client/ClientEnrollmentController.php` — `index()` : formations du client via `FormationEnrollment::where('learner_user_id', ...)`.
- [ ] `Api/Client/ClientLearnerController.php` — `show()` : fiche apprenant du client connecté (progression par module — réutiliser la logique déjà présente dans `LearnerController`/`AttendanceController` pour le staff, mais scopée à `auth()->id()`).
- [ ] `Api/Client/ClientAttendanceController.php` — `index()` : présences du client par module/session (`Attendance::where('learner_user_id', ...)`).
- [ ] `Api/Client/ClientLearnerObservationController.php` — `index()` (observations visibles du client, `visible_to_client = true` OU `author_user_id = auth()->id()`), `store()` (le client ajoute une observation sur un module d'une session à laquelle il est inscrit — vérifier l'inscription via `FormationEnrollment`/`SessionParticipant` avant d'autoriser).
- [ ] Routes dans `backend/routes/api.php`, sous le groupe existant `Route::middleware(['auth:sanctum', 'portal:client'])` (déjà présent lignes 79+) :
  ```
  Route::get('/client/orders', [ClientOrderController::class, 'index']);
  Route::post('/client/orders', [ClientOrderController::class, 'store']);
  Route::get('/client/orders/{order}', [ClientOrderController::class, 'show']);
  Route::post('/client/checkout', ClientCheckoutController::class);
  Route::get('/client/invoices', [ClientInvoiceController::class, 'index']);
  Route::get('/client/invoices/{invoice}', [ClientInvoiceController::class, 'show']);
  Route::post('/client/invoices/{invoice}/payment-proof', [ClientInvoiceController::class, 'uploadProof']);
  Route::get('/client/enrollments', [ClientEnrollmentController::class, 'index']);
  Route::get('/client/learner-profile', [ClientLearnerController::class, 'show']);
  Route::get('/client/attendances', [ClientAttendanceController::class, 'index']);
  Route::get('/client/observations', [ClientLearnerObservationController::class, 'index']);
  Route::post('/client/observations', [ClientLearnerObservationController::class, 'store']);
  ```

### 4.3 Workflow de validation des factures (caissier / directeur)

- [ ] `InvoiceController` (`backend/app/Http/Controllers/Api/InvoiceController.php`) : ajouter `validate(Invoice $invoice)` et `reject(Request $invoice)`, protégés par `permission:invoices.valider`.
  - `validate()` : refuse si `validation_status !== 'pending'` ; sinon passe `validation_status = validated`, `validated_by = auth()->id()`, `validated_at = now()`. C'est **ce passage** qui doit déclencher l'écriture comptable (voir point suivant).
  - `reject()` : `validation_status = rejected`, `rejection_reason` obligatoire ; notifie le client (email/notification — phase 2).
- [ ] Routes : `POST /api/invoices/{invoice}/validate`, `POST /api/invoices/{invoice}/reject`, dans le groupe staff existant.
- [ ] Filtre liste : `GET /api/invoices?validation_status=pending` doit fonctionner (ajouter le filtre dans `InvoiceController::index`, actuellement seul `status` paiement est filtrable — vérifier et étendre).
- [ ] **Comptabilité** : localiser précisément où `AccountingTransaction` est généré à partir d'une facture (recherche faite : la création se fait dans `AccountingController` avec un champ `invoice_id`, mais le déclenchement automatique depuis le paiement/la facture est à vérifier dans `InvoiceController::applyPayment()` / `pay()`). Ajouter une garde : **aucune écriture comptable automatique tant que `invoice.validation_status !== 'validated'`**. Concrètement :
  - Bloquer `InvoiceController::pay()` (encaissement) si la facture est `pending` — un caissier doit valider avant d'encaisser (ou valider = encaisser en une action, à trancher avec le métier).
  - Exclure les factures `pending`/`rejected` des agrégats de `AccountingController`, `StatsController`, `BilanController` (ils tournent probablement déjà sur `status` paiement — ajouter `where('validation_status', 'validated')` partout où une facture entre dans un total comptable/CA).
- [ ] `OrderController::invoice()` (ligne ~250 de `backend/app/Http/Controllers/Api/OrderController.php`) : fixer `validation_status`/`source` selon `order.channel` au lieu du `status: 'unpaid'` figé actuel.

### 4.4 Rôle Commercial — vente/inscription self-service + stats

- [ ] Vérifier l'existant dans `CommercialController` (`backend/app/Http/Controllers/Api/CommercialController.php`) : chercher un endpoint "moi" (self stats). S'il n'existe pas, ajouter `GET /api/commercial/me/stats` (ventes du mois, points, classement — réutiliser les requêtes déjà présentes dans `StatsController::topCommercials`/`CommercialReportController` en les scopant à `auth()->user()->commercial->id`).
- [ ] `OrderController::store()` : quand l'utilisateur connecté a le rôle `commercial`, forcer `commercial_id = $request->user()->commercial->id` (ne pas laisser un commercial créer une commande au nom d'un autre commercial) — actuellement `commercial_id` est libre dans le payload (`validateOrder`), à restreindre par rôle.
- [ ] Ces commandes doivent naître avec `channel = commercial_online` (à distinguer du guichet `in_person` si le commercial vend en agence via l'app interne vs. si un futur canal "commercial en ligne" existe — à clarifier selon le besoin réel ; sinon garder `in_person` pour toute vente initiée par un commercial dans l'app interne, et réserver `client_self` au vrai self-service).
- [ ] Confirmer que la facture résultante (`OrderController::invoice()`) passe en `validation_status = pending` dès lors qu'un commercial (pas caissier/admin) est l'auteur, pour respecter "une facture en pending [...] sera validée par la caissière et le directeur".

### 4.5 Rôle Caissier

- [ ] Confirmer permissions déjà correctes (`invoices.creer`, `invoices.encaisser` — présentes dans `RoleSeeder.php`), ajouter `invoices.valider` (point 3, seed).
- [ ] Endpoint file d'attente : `GET /api/invoices?validation_status=pending` (voir 4.3) exploitable tel quel par le caissier.

---

## 5. Frontend — App interne existante `frontend/` (ajouts)

- [ ] `src/pages/commercials/CommercialSelfDashboardPage.tsx` : stats perso (appel `GET /api/commercial/me/stats`), raccourcis "Voir le catalogue" / "Nouvelle vente ou inscription" (réutilise `QuickSalePage`/`InvoiceFormPage` existants en verrouillant `commercial_id`).
- [ ] `src/pages/invoices/PendingInvoicesPage.tsx` : liste des factures `validation_status=pending`, actions "Valider"/"Rejeter" (visibles seulement si permission `invoices.valider` — pattern déjà utilisé ailleurs dans le repo pour les permissions, à réutiliser).
- [ ] `src/router/index.tsx` : ajouter les routes `/commercial/dashboard` et `/invoices/pending` dans l'arborescence `ProtectedRoute > AppLayout`.
- [ ] Menu de navigation (chercher le fichier de config du menu, probablement dans `src/components/layout/`) : entrées conditionnelles par rôle (`commercial` → "Mon tableau de bord", "Catalogue", "Nouvelle vente" ; `caissier`/directeur → "Factures à valider").
- [ ] `src/api/` : nouveau module `invoicesValidation.ts` (ou extension du client `invoices` existant) pour `validate`/`reject`/`filter by validation_status`.

## 6. Frontend — Nouveau site client (nouvelle app, ex. `site-client/`)

Pages publiques (sans authentification) :
- [ ] Accueil (présentation Pekegno, mise en avant catégories).
- [ ] Catalogue (`/produits`) — liste services + formations, filtres pays → agence → catégorie (consomme `/api/public/services`, `/api/public/products`, `/api/public/countries`, `/api/public/agencies`).
- [ ] Fiche produit/formation (`/produits/:slug`) — description, prix, sessions à venir si formation, bouton **Commander**.
- [ ] Flux "Commander" : si non connecté → redirection `/connexion?redirect=/produits/:slug` ou `/inscription?redirect=...` ; sinon → écran de paiement.
- [ ] Écran paiement (`/paiement/:orderId`) : affiche le(s) numéro(s) OM/MoMo de l'agence sélectionnée (`/api/public/agencies/:id/payment-methods`), formulaire de dépôt de preuve (référence + upload fichier → `POST /api/client/invoices/:id/payment-proof`).
- [ ] Auth : `/connexion`, `/inscription`, `/mot-de-passe-oublie` (réutilisent `/api/client/login`, `/api/auth/register`, `/api/auth/forgot-password`).

Espace client (authentifié, `portal:client`) :
- [ ] Tableau de bord client (résumé commandes/factures/formations en cours).
- [ ] `/mon-compte/commandes` (liste + détail) → `/api/client/orders`.
- [ ] `/mon-compte/factures` (liste + détail, statut de validation visible, upload preuve si `pending`) → `/api/client/invoices`.
- [ ] `/mon-compte/formations` (mes inscriptions) → `/api/client/enrollments`.
- [ ] `/mon-compte/fiche-apprenant` (progression par module, observations par module avec possibilité d'en ajouter, présences) → `/api/client/learner-profile`, `/api/client/attendances`, `/api/client/observations`.
- [ ] `/mon-compte/profil` (infos perso, mot de passe) → réutilise `/api/client/me` + endpoint changement mot de passe existant.

Technique :
- [ ] Nouveau projet Vite + React + TypeScript, même stack que `frontend/` pour cohérence (i18n, Tailwind/UI kit à vérifier dans `frontend/src/components/ui/` et réutiliser les mêmes tokens de design).
- [ ] Client HTTP dédié pointant sur la même API backend (`VITE_API_URL`), avec gestion de token Sanctum côté client distincte de celle du staff.
- [ ] Déploiement séparé (nouveau service sur Render/Vercel, voir `render.yaml` et `frontend/vercel.json` comme modèles).

---

## 7. Ordre d'exécution suggéré

1. **Migrations + modèles** (section 3) — base commune aux deux frontends.
2. **API publique** (4.1) — débloque le développement du catalogue client sans attendre le reste.
3. **Workflow validation factures** (4.3) — cœur métier ("pending" hors comptabilité), à sécuriser avant d'ouvrir le self-service.
4. **Espace client API** (4.2) — commandes/factures/preuve de paiement/formations/apprenant.
5. **Nouveau frontend site client** (section 6) — peut démarrer en parallèle du point 4 sur les pages publiques (3).
6. **Ajouts app interne** (section 5) — dashboard commercial + file de validation caissier.
7. **Phase 2 (optionnel)** : notifications email/SMS à la validation/rejet, panier multi-articles persistant, génération de reçu PDF téléchargeable côté client.

---

## 8. Points à confirmer avec vous avant implémentation

- "Valider" une facture pending doit-il aussi déclencher l'encaissement (paiement) en une seule action caissier, ou rester deux étapes distinctes (valider, puis encaisser séparément) ?
- Choix définitif : nouvelle app frontend séparée (recommandé) vs. nouvelles routes publiques dans `frontend/` existant.

---

## 9. Tickets — Rapport de tests Academy (2026-09-28)

Source : `doc/test.pdf` (cahier de recette PEKEGNO Academy du 28 septembre 2026). Tickets triés par priorité : P0 = bloquant / impact financier, P1 = important (flux de vente ou d'administration dégradé), P2 = moyen (UX / confort), P3 = mineur / cosmétique.

### 🔴 P0 — Critique (argent & données)

- [x] **T1 — Bilan du jour : colonnes produits & formations à zéro** — Ajouter une colonne par produit (4 produits = 4 colonnes) + une colonne « formations » juste après la date, puis total vente et détails. Actuellement tout affiche 0 : vérifier le grand tableau Excel du système et les agrégats backend (voir `BilanController`). ✅ Corrigé le 2026-09-28 : `BilanService` agrège produits + formations (sans double comptage), colonnes ajoutées au tableau période/vue jour/CSV, `product_id` accepté et enregistré à la création de facture. **Complément (revue du 28/09)** : les colonnes n'apparaissaient que s'il y avait eu des ventes sur la période (tableau « vide » de la capture). Les « 4 produits » du cahier de recette sont les catégories de services du catalogue (Conseil, Audit, Séminaire, Autres…) : `/api/bilans/period` renvoie désormais `sale_categories` (toutes les catégories) et le tableau affiche une colonne par catégorie même à 0, dans l'ordre Date → Formations → catégories → Total ventes. Une catégorie « Formations » est fusionnée dans la colonne Formations. Le modèle `Product` n'est vendable nulle part dans le back-office : ses colonnes restent affichées seulement si des ventes existent.
- [x] **T2 — Chiffre d'affaires incohérent de l'agence jusqu'à PEKEGNO GROUP** — Les chiffres ne concordent pas entre les niveaux agence → pays → PEKEGNO GROUP. Auditer les agrégats (`StatsController` / `AccountingController`) et harmoniser les périmètres (factures validées uniquement ? devis exclus ?). ✅ Corrigé le 2026-09-28 : `validated()` (factures payées + validées + non annulées) désormais appliqué partout — `DashboardController` (navigation Groupe→Pays→Ville→Agence, encaissements inclus), `ReportController`, `AgencyController::index`, classements commerciaux (`CommercialController`), `CommercialReportService`, `AcademyReportService` ; test de cohérence agence = groupe ajouté (`test_agency_revenue_matches_group_aggregate`).
- [x] **T3 — Modification d'une agence : le changement de pays ne fonctionne pas** — Changer le pays d'une agence doit mettre à jour le pays de l'agence ET réaffecter tous ses éléments rattachés (utilisateurs, commandes, factures, catalogues...) au nouveau pays.
- [x] **T4 — Une caissière ne peut pas payer une commission** — Permettre l'encaissement d'une commission par le rôle caissier (vérifier les permissions et le contrôleur commissions).
  > ✅ Complément (revue du 28/09) : seule la route `POST /commissions/entries/{entry}/pay` acceptait `commissions.encaisser`. Les boutons réellement utilisés par l'Academy (« Payer la commission » : `POST /seller-profiles/{id}/pay`) et la comptabilité (`POST /commission-payments`) exigeaient encore `commissions.valider` → 403 pour la caissière. Les deux routes acceptent maintenant `commissions.valider,commissions.encaisser` (test `test_cashier_can_pay_commission_from_academy_and_accounting_screens`). Prod : permission ajoutée à `doc/deploy/seed-roles-permissions.sql` et à `doc/deploy/migration-2026-09-28.sql`.

### 🟠 P1 — Important (flux de vente & administration)

- [x] **T5 — Nouvelle inscription : réduction % ou montant fixe** — Permettre d'appliquer une remise (pourcentage ou montant fixe) à un apprenant lors d'une inscription, quel que soit le rôle (commercial, caissière, autre).
  > ✅ Corrigé le 2026-09-28 : `discount_type` (`amount`/`percent`) + `discount_value` sur `formation_enrollments`, résolus en montant par `resolveDiscountAmount()` et plafonnés au prix de la formation. La facture générée porte la remise dans `invoices.discount` et `total_amount` = net (ligne conservée au prix catalogue, cohérent avec une facture saisie au guichet) ; le plafond d'encaissement suit le montant net et la remise est tracée dans le journal d'activité. Formulaire de remise ajouté aux deux points d'entrée (modale + page liste), montant net affiché avant validation. Aucune permission ajoutée : `enrollments.creer` couvre déjà commercial et caissier.
- [x] **T6 — Nouvelle inscription : formations en ligne + type affiché** — Lister aussi les formations en ligne (pas seulement présentiel) et afficher le type à côté du nom : « Nom de la formation – Type (ligne/présentiel) ».
  > ✅ Corrigé le 2026-09-28 : le catalogue listait déjà les formations en ligne (aucun filtre `mode` par défaut côté API), mais rien ne les distinguait et le champ « session » était obligatoire — une formation en ligne sans session était donc impossible à inscrire. Ajout de `courseOptionLabel()` (« Nom — Type · Prix ») dans les trois menus d'inscription, session devenue facultative pour une formation `online` (`isOnlineCourse()`), et `assignToAvailableSessions()` n'affecte plus l'apprenant à toutes les sessions quand aucune n'est choisie (seulement si elle est unique). `modeLabel()` dupliqué dans 2 pages remplacé par le helper partagé `courseModeLabel()`. Seeder corrigé : `PublicCatalogSeeder` écrivait `presentiel`, hors de la nomenclature `online|in_person|mixed` (2 lignes de la base de dev corrigées).
- [x] **T7 — Annulation d'une facture : formulaire non réinitialisé + mauvaise redirection** — Après annulation, réinitialiser le formulaire et rester au plus près de l'endroit où on était (redirection contextuelle).
  > ✅ Corrigé le 2026-09-28 : le défaut venait de redirections codées en dur. Nouveau helper `frontend/src/utils/invoiceNavigation.ts` (`invoiceListPath`, `invoiceListPathForDetail`, `withInvoiceFilters`, `invoiceOrigin`, `invoiceBackPath`) : les listes mémorisent leur origine (`state.from` = chemin + filtres + page) et les écrans la restituent. `InvoiceDetailPage` déduisait toujours la liste globale — une facture ouverte depuis un pays renvoyait vers `/invoices` ; le chemin de retour est maintenant dérivé de l'URL (`/countries/:id/invoices/:id` → `/countries/:id/invoices`) ou prend l'origine mémorisée. L'annulation referme les modales ouvertes (encaissement, édition, impression, preuve) et remet les formulaires à zéro au lieu de laisser la saisie précédente derrière ; fermer une modale sans valider ne laisse plus de valeurs non réinitialisées. `InvoiceListPage` : la page passe dans l'URL comme les autres filtres (retour sur la bonne page) et chaque ouverture de facture mémorise l'origine. `QuickSalePage` (écran « Encaisser ») : plus de redirection vers le détail après une vente — le guichet reste en place, le formulaire est vidé (preuve de paiement comprise, via remontage du champ fichier) et un lien vers la facture créée est affiché. `InvoiceFormPage`, `PendingInvoicesPage`, `ReceivablesPage` et le lien « vente rapide » du tableau de bord caissier mémorisent eux aussi leur origine. Aucun changement backend (334/334 tests, `tsc -b --noEmit` OK) ; le frontend n'est pas couvert par la suite de tests du dépôt.
- [x] **T8 — Création d'utilisateur : email automatique** — À la création d'un utilisateur, lui envoyer un email avec ses paramètres de connexion et son mot de passe par défaut.
  > ✅ Corrigé le 2026-09-28 : aucun email n'était envoyé à la création d'un compte. Nouveau mailable `App\Mail\UserWelcomeMail` + vue `emails/user-welcome.blade.php` (identifiant, nom d'utilisateur, mot de passe, rôle attribué, bouton « Se connecter » vers `{FRONTEND_URL}/login`). `UserController::store()` conserve désormais le mot de passe en clair avant `Hash::make()` (l'interface de création ne le demande pas : `UserListPage` envoie en dur `password`/`password_confirmation`, le défaut du backend étant le même littéral) et expédie l'email après la transaction. L'envoi est encadré par un `try/catch` journalisé : un SMTP injoignable n'annule plus la création du compte, l'administrateur reste responsable de communiquer les identifiants. Lien construit via `config('app.frontend_url')` plutôt que `env()` directement. 5 tests dédiés (`UserWelcomeMailTest` : contenu du mail, mot de passe par défaut utilisable, mot de passe choisi par l'admin, échec SMTP non bloquant, rendu de la vue). 339/339 tests, Pint OK. Réserve : en développement `MAIL_MAILER=log`, le message part dans les logs - une livraison réelle suppose un SMTP configuré.
- [x] **T9 — Admin : réinitialisation du mot de passe d'un utilisateur** — Bouton/action permettant à l'administrateur de réinitialiser le mot de passe de n'importe quel utilisateur.
  > ✅ Corrigé le 2026-09-28 : aucun moyen de réinitialiser le mot de passe d'un utilisateur depuis l'interface (seul le « mot de passe oublié » personnel existait). Nouvelle route `POST /api/users/{user}/reset-password` (`UserController::resetPassword`) : un mot de passe provisoire de 16 caractères est généré (`Str::password`, comme à la création d'un client), `is_password_change_required` passe à `true`, les demandes de réinitialisation en attente et les sessions actives (jetons Sanctum) de l'utilisateur sont révoqués, l'opération est tracée dans le journal d'activité (`password_reset`) et le nouveau mot de passe est envoyé par email (`App\Mail\AdminPasswordResetMail` + vue `emails/admin-password-reset.blade.php`, envoi encadré par un `try/catch` journalisé comme en T8). L'administrateur ne choisit jamais le mot de passe. Autorisation : super-admin et direction générale uniquement, la direction générale ne peut pas réinitialiser un super-administrateur. Côté interface, bouton clé dans les actions de ligne de `UserListPage` (visible uniquement si la règle est satisfaite) avec confirmation expliquant l'envoi de l'email et la fermeture des sessions. 7 tests dédiés (`AdminPasswordResetTest`), 346/346 tests, `tsc -b --noEmit` et Pint OK. Réserve : `is_password_change_required` n'est toujours appliqué nulle part à l'exécution (aucun middleware ne redirige vers un changement de mot de passe) - le champ reste décoratif, comme en T8.
- [x] **T10 — Menu « Validation de facture » manquant en superadmin** — Ajouter l'entrée de menu en mode superadmin (visibilité/permission à corriger).
  > ✅ Corrigé le 2026-09-28 : ce n'était pas un problème de permission. Le menu est uniquement basé sur les rôles (`getMainItems()`), et la branche `ADMIN_ROLES` (super-admin + direction générale) ne listait que « Créances » côté factures - l'entrée « Validation » n'existait que dans la branche caissier. Pourtant tout le reste était déjà en place : `CAN_VALIDATE_ROLES` de `ContextBar` include le super-admin, la route `/invoices/pending` est déclarée dans le routeur, `PendingInvoicesPage` affiche les boutons valider/rejeter pour le super-admin, et le backend autorise l'action (`RoleSeeder` donne toutes les permissions à `super-admin` et `direction-generale`, dont `invoices.valider`). Le super-admin atteignait donc la page uniquement via la cloche de notification, sans entrée de menu - d'où le signalement. Ajout de `{ to: '/invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck }` dans la branche admin de `navItems.ts`, à côté de « Créances » ; la correction couvre donc aussi la direction générale, qui était dans le même cas. `Sidebar` et `MobileNav` consommant `getMainItems()`, les deux navigations sont corrigées d'un coup. Correction purement front : `tsc -b --noEmit` OK, 346/346 tests backend (aucun changement PHP). À noter pour un ticket ultérieur, hors périmètre ici : la branche admin n'a pas d'entrée « Factures » (`/invoices`) alors que `INVOICES_ROLES` includes le super-admin pour le calcul du badge impayés et que la route existe.

### 🟡 P2 — Moyen (UX & configuration)

- [x] **T11 — Monnaie du pays dans les factures/devis + équivalence PEKEGNO GROUP** — À la création d'un pays avec sa monnaie (ex. Côte d'Ivoire → XOF), l'utiliser dans factures, devis, etc. Ajouter un système d'équivalence pour l'affichage groupe (ex. 1 XAF = 1 XOF).
  > ✅ Corrigé le 2026-09-28 : `formatCurrency` affichait « FCFA » en dur partout. Nouvelle colonne `countries.exchange_rate` (1 unité locale = x unités du groupe, défaut 1) + réglage `group_currency` (XAF par défaut, modifiable dans Réglages). Les factures exposent `currency_code` (pays de l'agence) : détail, impression (montant en lettres compris), listes, validation et créances l'utilisent. Ailleurs, la monnaie d'affichage suit la page consultée (`useDisplayCurrencySync` : pays / agence / département de l'URL, sinon le seul pays accessible, sinon la monnaie du groupe) ; les libellés i18n « (FCFA) » sont devenus « ({{currency}}) ». Agrégats multi-pays convertis via `App\Support\GroupCurrency` : `StatsController` (overview, group, CA mensuel sans filtre, top commerciaux/produits/agences, ventes par catégorie, modes de paiement) et `DashboardController` au niveau groupe (le niveau pays reste en monnaie locale). Fiche pays : ajout du mode **modification** (inexistant) avec le taux d'équivalence. Test `test_group_aggregates_convert_country_currency`. Hors périmètre : pas d'écran « devis » dans le back-office ; le bilan consolidé multi-pays et la comptabilité additionnent encore sans conversion (sans effet tant que 1 XOF = 1 XAF).
- [x] **T12 — Nouvelle inscription : sélectionner tous les pays par défaut**.
  > ✅ Corrigé le 2026-09-28 : d'après la capture du cahier de recette, il s'agit du bloc « Déployer aussi dans d'autres pays » de la **création de formation** (`AcademyCoursesPage`), pas de l'inscription (qui n'a aucun choix de pays). Tous les pays actifs sont désormais cochés à l'ouverture du formulaire.
- [x] **T13 — Header : liens retour et liste déroulante cassés** — Les sous-menus ne s'affichent pas ; vérifier les composants de navigation (et les champs `select` en général).
  > ✅ Corrigé le 2026-09-28 (reproduit dans Chrome) : `OrgProvider` chargeait `/scope/context` une seule fois au démarrage de l'app, **avant** la connexion (401) → les listes Pays/Agence/Département restaient vides jusqu'à un rechargement de page. Rechargement à chaque connexion / changement de compte. Sur les pages globales la sélection restait pré-remplie (1er pays/agence) et re-choisir la même valeur ne déclenchait rien : elle est maintenant vidée hors pages pays/agence/département. L'option vide sert de « retour » (département → agence → pays → PEKEGNO GROUP). Les boutons retour étaient masqués sous 1024 px et sans icône : visibles à toutes les tailles avec flèche.
- [x] **T14 — Mot de passe oublié : envoyer réellement un email** à l'utilisateur.
  > ✅ Corrigé le 2026-09-28 : le code envoyait déjà un email ; en production le SMTP n'est pas configuré (`MAIL_MAILER=log` de `.env.example`, aucune mention dans le guide) → les messages finissent dans `laravel.log`. Procédure SMTP o2switch ajoutée (`doc/deploy/README.md` §3.8). Côté code : plus d'email ni de jeton pour une adresse inconnue (réponse identique), lien construit avec `http_build_query` (emails avec `+`), échec SMTP → 503 explicite + log au lieu d'une 500, `throttle:5,1` sur la route. **Action requise** : renseigner les variables `MAIL_*` dans le `.env` de prod.
- [x] **T15 — Proposition automatique de nom d'utilisateur** à partir du nom/prénom saisis.
  > ✅ Corrigé le 2026-09-28 : `GET /api/users/username-suggestion` (« prenom.nom » sans accents, suffixe numérique si déjà pris) + hook `useUsernameSuggestion` dans les deux formulaires de création (`UserListPage`, `CreateUserModal`). Une saisie manuelle n'est jamais écrasée. 3 tests (`UsernameSuggestionTest`).
- [x] **T16 — Filtres période (aujourd'hui, hier, ce mois...)** — Les insérer partout où c'est nécessaire (listes, bilans, stats).
  > ✅ Corrigé le 2026-09-28 : composant `PeriodPresets` (Aujourd'hui, Hier, Cette semaine, Semaine dernière, Ce mois, Mois dernier, 30 derniers jours, Cette année, + « Tout » sur les listes), raccourci actif surligné. Intégré aux tableaux de bord (via `PeriodPicker`), bilan du jour (période + jour), factures, comptabilité, créances Academy, journal d'audit, rapports (abonnements/clients/Academy) et rapport commerciaux/employés. Bug corrigé au passage (visible sur la capture) : les bornes étaient calculées via `toISOString()` (UTC) → « Ce mois » commençait le 31 du mois précédent au Cameroun ; toutes les dates « du jour » passent par `todayLocal()`.

### ⚪ P3 — Mineur / cosmétique

- [x] **T17 — Clic sur le logo PEKEGNO → dashboard général**.
  > ✅ Corrigé le 2026-09-28 : composant `BrandLogo` (lien vers `/`) dans le header, la sidebar et le menu mobile.
- [x] **T18 — Changer le logo de PEKEGNO**.
  > ✅ Corrigé le 2026-09-28 : logo `doc/logo.jpeg` recadré, fond rendu transparent (`frontend/src/assets/pekegno-logo.png`) et utilisé dans le header, la sidebar, le menu mobile, la page de connexion et l'impression des factures. Favicon (carré « P ») ajouté : `index.html` pointait vers un `/favicon.ico` inexistant (404).
- [x] **T19 — Vérifier l'ensemble des champs « select »** (comportement, affichage des options).
  > ✅ Revue le 2026-09-28 : les 85 `Select` et 42 `<select>` passés en revue ; ceux sans option vide sont des énumérations avec valeur par défaut (OK). Deux vrais défauts corrigés : le header (T13) et le **pays de l'agence** (T3), qui était un champ texte sur la liste mondiale statique puis résolu par recherche `LIKE` du nom (« Niger » ↔ « Nigeria », apostrophe typographique introuvable → pays non envoyé, changement ignoré en silence) : remplacé par un vrai `select` des pays en base, `country_id` obligatoire.

### Corrections après recette du 29/09

- [x] **Caissière : paiement des commissions introuvable** — menu « Commissions » (`/caissier/commissions`) : bénéficiaires de son agence, solde dû, bouton Payer. Liste et paiements limités au périmètre de l'utilisateur (`ScopeService`) côté API. Permission ajoutée aussi par migration (`2026_09_29_000001`) : le RoleSeeder ne met pas à jour une base existante (cause du « Action non autorisée »).
- [x] **Factures d'un pays** : la liste n'était pas filtrée par pays (factures de Douala sous Côte d'Ivoire) et ouvrir une facture renvoyait vers la vue groupe. Même défaut corrigé pour Comptabilité, Audit et Abonnements sous un pays.
- [x] **T11 XOF absent des factures** : la liste charge l'agence sans `country_id` → monnaie retombait sur XAF. Monnaie résolue depuis `agency_id` ; formulaires de vente/inscription en monnaie de l'agence choisie.
- [x] **Nouvelle inscription depuis un pays** : aucune formation listée (la modale exigeait une agence). Formations du pays proposées, agence déduite de la formation.
- [x] **T9 sur les pages Équipes** (agence et département) : composant `ResetPasswordButton`.
- [x] **2FA toujours « non activée »** : `GET /api/user` ne renvoyait pas `two_factor_enabled` (test `TwoFactorStatusTest`).
- [x] **Inscription payée absente du « Total encaissé »** : `amount_paid` écrit sans paiement (ni caisse, ni compta, ni commission). Passe désormais par `PaymentService` ; commande `invoices:repair-enrollment-payments` (+ `doc/deploy/repair-enrollment-payments.php`) pour l'historique.
- [x] **Bilan : fuseau horaire** — journées calculées en Africa/Douala (vente de 00:02 classée la veille, « aujourd'hui » faux entre minuit et 1 h ; numéros de facture idem). **Solde initial consolidé** = somme des agences (était 0).
- [x] **Facture imprimable au format du modèle Word** — en-tête/pied/comptes/cachet par pays (`countries.invoice_settings`, saisis dans la fiche pays), description (modules / description du service) et période (dates de session) par ligne ; impression hors modale (la facture était coupée).
- [x] **T3 complété** : clients inscrits dans l'agence et règles de commission suivent le nouveau pays ; la page bascule sous le nouveau pays.
- [x] Formations `presentiel` (hors nomenclature) normalisées ; menu « Factures » pour le super-admin ; carte « Total encaissé » (au lieu de « Chiffre d'affaires ») sur la liste des factures.
- [ ] **Emails en production** : code OK, envoi bloqué côté serveur — diagnostic `doc/deploy/mail-test.php` (probable blocage SMTP sortant o2switch vers Gmail → utiliser une boîte cPanel).
