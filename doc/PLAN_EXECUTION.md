# Plan d'Execution — PEKEGNO : Separation "Site Client" / "Pekegno Management"

Date : 2026-09-07
Stack : Laravel 13 (PHP 8.3) + React 19 (TypeScript, Vite, Tailwind CSS 4) + PostgreSQL

## Contexte

PEKEGNO est une plateforme SaaS multi-agence (CRM, Formations, Facturation, Comptabilite). Le backoffice interne (`frontend/`) est complet et fonctionnel. L'objectif est de creer un **site client separe** (`frontend_client/`) permettant aux clients de :
- Parcourir le catalogue publique (services, formations)
- Passer des commandes et payer (Orange Money / MTN MoMo)
- Consulter leurs factures, formations, presences et observations

Le workflow de validation des factures (caissier/directeur) sera egalement ajoute au backoffice interne.

---

## Decisions d'architecture

1. **Validation et Encaissement** : deux etapes separees (valider, puis encaisser separement)
2. **Frontend client** : nouvelle app Vite + React + TS separee (`frontend_client/`), meme stack que `frontend/`
3. **API backend commune** : les deux frontends consomment la meme API Laravel

---

## Phase 1 — Base de donnees (migrations + modeles)

**Priorite : HAUTE | Pre-requis a tout le reste**

| # | Tache | Fichiers concernes |
|---|---|---|
| 1.1 | Ajouter `is_public` (bool) + `slug` (string, unique nullable) a `services` et `products` | Migration, `Service.php`, `Product.php` |
| 1.2 | Ajouter `cover_image` (string nullable) a `products` | Migration, `Product.php` |
| 1.3 | Ajouter `channel` (enum: `in_person`, `commercial_online`, `client_self`, default `in_person`) a `orders` | Migration, `Order.php` |
| 1.4 | Ajouter le workflow de validation a `invoices` : `validation_status` (enum: `pending`, `validated`, `rejected`, default `validated`), `validated_by` (uuid nullable FK users), `validated_at` (timestamp nullable), `rejection_reason` (text nullable), `source` (enum: `in_person`, `commercial_online`, `client_self`, default `in_person`) | Migration, `Invoice.php` |
| 1.5 | Creer la table `payment_proofs` : `id` (uuid), `invoice_id` (FK), `submitted_by` (FK users nullable), `payment_method` (string), `phone_number_used` (string nullable), `reference` (string nullable), `file_path` (string), `status` (enum: `pending`, `accepted`, `rejected`, default `pending`), `reviewed_by` (FK users nullable), `reviewed_at` (timestamp nullable), `notes` (text nullable), timestamps | Migration, nouveau `PaymentProof.php`, relation `Invoice` |
| 1.6 | Creer la table `agency_payment_methods` : `id`, `agency_id` (FK), `provider` (string), `phone_number` (string nullable), `account_holder` (string nullable), `instructions` (text nullable), `is_active` (bool default true), timestamps | Migration, nouveau `AgencyPaymentMethod.php`, relation `Agency` |
| 1.7 | Enrichir `learner_observations` : ajouter `course_module_id` (FK nullable vers `course_modules`), `author_user_id` (FK users), `visible_to_client` (bool default true) | Migration, `LearnerObservation.php` |
| 1.8 | Seeder la permission `invoices.valider` + l'attribuer aux roles `caissier` et `direction-generale` | `PermissionSeeder.php`, `RoleSeeder.php` |

---

## Phase 2 — API publique (non authentifiee)

**Priorite : HAUTE | Debloque le catalogue client**

| # | Tache | Fichiers concernes |
|---|---|---|
| 2.1 | Creer `PublicCatalogController` avec methodes : `countries()`, `agencies()`, `services()`, `service()`, `products()`, `product()`, `agencyPaymentMethods()` | `app/Http/Controllers/Api/Public/PublicCatalogController.php` |
| 2.2 | Declencher les routes `/api/public/*` hors middleware auth dans `routes/api.php` | `routes/api.php` |

Routes :
```
GET /api/public/countries
GET /api/public/agencies?country_id=
GET /api/public/services?country_id=&category_id=
GET /api/public/services/{service}
GET /api/public/products?country_id=&category_id=
GET /api/public/products/{product}
GET /api/public/agencies/{agency}/payment-methods
```

---

## Phase 3 — Workflow de validation des factures

**Priorite : HAUTE | Coeur metier**

| # | Tache | Fichiers concernes |
|---|---|---|
| 3.1 | Ajouter `validate()` et `reject()` a `InvoiceController` (permission `invoices.valider`) | `InvoiceController.php`, `routes/api.php` |
| 3.2 | Etendre `InvoiceController::index()` pour filtrer par `validation_status=pending` | `InvoiceController.php` |
| 3.3 | Bloquer `InvoiceController::pay()` si `validation_status === 'pending'` | `InvoiceController.php` |
| 3.4 | Exclure factures `pending`/`rejected` des agrégats (`AccountingController`, `StatsController`, `BilanController`) | `AccountingController.php`, `StatsController.php`, `BilanController.php` |
| 3.5 | Corriger `OrderController::invoice()` pour fixer `validation_status`/`source` selon `order.channel` | `OrderController.php` |

Routes ajoutees :
```
POST /api/invoices/{invoice}/validate
POST /api/invoices/{invoice}/reject
```

---

## Phase 4 — API espace client (`portal:client`)

**Priorite : MOYENNE | Self-service client**

| # | Tache | Fichiers concernes |
|---|---|---|
| 4.1 | `ClientOrderController` : `index()`, `store()`, `show()` — commandes scope client | `app/Http/Controllers/Api/Client/ClientOrderController.php` |
| 4.2 | `ClientCheckoutController` : `POST /api/client/checkout` — flux un clic (commande + facture) | `app/Http/Controllers/Api/Client/ClientCheckoutController.php` |
| 4.3 | `ClientInvoiceController` : `index()`, `show()`, `uploadProof()` | `app/Http/Controllers/Api/Client/ClientInvoiceController.php` |
| 4.4 | `ClientEnrollmentController` : `index()` | `app/Http/Controllers/Api/Client/ClientEnrollmentController.php` |
| 4.5 | `ClientLearnerController` : `show()` — fiche apprenant | `app/Http/Controllers/Api/Client/ClientLearnerController.php` |
| 4.6 | `ClientAttendanceController` : `index()` | `app/Http/Controllers/Api/Client/ClientAttendanceController.php` |
| 4.7 | `ClientLearnerObservationController` : `index()`, `store()` | `app/Http/Controllers/Api/Client/ClientLearnerObservationController.php` |
| 4.8 | Factoriser `OrderInvoicingService` (logique commande+facture partagee) | `app/Services/OrderInvoicingService.php` |
| 4.9 | Declencher toutes les routes `/api/client/*` dans le groupe `portal:client` | `routes/api.php` |

Routes :
```
GET    /api/client/orders
POST   /api/client/orders
GET    /api/client/orders/{order}
POST   /api/client/checkout
GET    /api/client/invoices
GET    /api/client/invoices/{invoice}
POST   /api/client/invoices/{invoice}/payment-proof
GET    /api/client/enrollments
GET    /api/client/learner-profile
GET    /api/client/attendances
GET    /api/client/observations
POST   /api/client/observations
```

---

## Phase 5 — Frontend interne `frontend/` (ajouts)

**Priorite : MOYENNE**

| # | Tache | Fichiers concernes |
|---|---|---|
| 5.1 | `CommercialSelfDashboardPage.tsx` — stats perso + raccourcis vente | `src/pages/commercials/` |
| 5.2 | `PendingInvoicesPage.tsx` — file d'attente validation | `src/pages/invoices/` |
| 5.3 | Routes `/commercial/dashboard` et `/invoices/pending` | `src/router/index.tsx` |
| 5.4 | Menu navigation conditionnel par role (commercial, caissier) | `src/components/layout/` |
| 5.5 | Client API `invoicesValidation.ts` (validate/reject/filter) | `src/api/` |

---

## Phase 6 — Nouveau site client `frontend_client/`

**Priorite : MOYENNE | Peut demarrer des Phase 2 terminee**

### 6.1 Initialisation
- Nouveau projet Vite + React + TypeScript
- Meme stack que `frontend/` (i18n, Tailwind CSS, meme design system)
- Client HTTP dedie + session Sanctum separee du staff

### 6.2 Pages publiques (sans auth)
| Route | Page |
|---|---|
| `/` | Accueil (presentation Pekegno, categories mises en avant) |
| `/produits` | Catalogue — liste services + formations, filtres pays/agence/categorie |
| `/produits/:slug` | Fiche produit/formation detaillee + bouton "Commander" |
| `/connexion` | Login client |
| `/inscription` | Inscription client |
| `/mot-de-passe-oublie` | Reset mot de passe |
| `/paiement/:orderId` | Ecran paiement (numeros OM/MoMo + upload preuve) |

### 6.3 Espace client authentifie
| Route | Page |
|---|---|
| `/mon-compte` | Dashboard (resume commandes/factures/formations) |
| `/mon-compte/commandes` | Liste + detail commandes |
| `/mon-compte/factures` | Liste + detail factures (statut validation, upload preuve) |
| `/mon-compte/formations` | Mes inscriptions |
| `/mon-compte/fiche-apprenant` | Progression par module, observations, presences |
| `/mon-compte/profil` | Infos perso + mot de passe |

### 6.4 Deploiement
- Service separe sur Vercel (mode SPA avec rewrites)
- `VITE_API_URL` pointant vers le backend Laravel

---

## Ordre d'execution

```
Phase 1 (DB)  -->  Phase 2 (API publique)  -->  Phase 3 (Validation factures)
                                                          |
                                                          v
                                                  Phase 4 (API client)
                                                          |
                                              +-----------+-----------+
                                              |                       |
                                              v                       v
                                      Phase 5 (ajouts)       Phase 6 (site client)
                                      frontend interne        frontend_client/
```

## Phase 2 optionnelle (apres les 6 phases)

- Notifications email/SMS a la validation/rejet de facture
- Panier multi-articles persistant
- Generation de recu PDF telechargeable cote client
