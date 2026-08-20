# Rapport Complet de Developpement - PEKEGNO Platform

**Date :** 19 aout 2026
**Version :** 1.0

---

## Table des matieres

1. [Architecture Generale](#1-architecture-generale)
2. [Modelisation de la Base de Donnees](#2-modelisation-de-la-base-de-donnees)
3. [Module Abonnements](#3-module-abonnements)
4. [Systeme de Notifications](#4-systeme-de-notifications)
5. [Renommer Equipes vers Utilisateurs](#5-renommer-equipes-vers-utilisateurs)
6. [Filtres Commercial et Produits](#6-filtres-commercial-et-produits)
7. [Authentification Dissociee Client / Admin](#7-authentification-dissociee-client--admin)
8. [Portail Client (Catalogue + Panier)](#8-portail-client-catalogue--panier)
9. [Rapport Commercial - Filtres Date](#9-rapport-commercial---filtres-date)
10. [Separation Geographique (Cameroun / Cote d'Ivoire)](#10-separation-geographique)
11. [Structure Agency / Academy](#11-structure-agency--academy)
12. [Categorisation des Clients](#12-categorisation-des-clients)
13. [Table des Pays en Base](#13-table-des-pays-en-base)
14. [Services Manuels dans les Abonnements](#14-services-manuels-dans-les-abonnements)
15. [Prix Personnalisables par Client](#15-prix-personnalisables-par-client)
16. [Selecteur de Periode pour les Stats](#16-selecteur-de-periode-pour-les-stats)
17. [Filtres sur Toutes les Pages de Listes](#17-filtres-sur-toutes-les-pages-de-listes)
18. [Recapitulatif des Modifications Backend](#18-recapitulatif-des-modifications-backend)
19. [Recapitulatif des Modifications Frontend](#19-recapitulatif-des-modifications-frontend)
20. [Planning d'Implementation](#20-planning-dimplementation)

---

## 1. Architecture Generale

### 1.1 Stack Technique Actuelle

| Couche | Technologie |
|--------|-------------|
| Backend | Laravel 11 + Sanctum |
| Frontend | React 18 + TypeScript + Vite |
| Base de donnees | MySQL |
| Auth | Laravel Sanctum (tokens API) |
| UI | Tailwind CSS + composants custom |

### 1.2 Modifications Architecturales Prevues

- **Deux portails d'authentification distincts** : `/login` (admin/employe) et `/client/login` (client)
- **Nouveau modele `Country`** pour structurer les pays/agences
- **Nouveau modele `ClientCategory`** pour categoriser les clients (apprenant, abonne, etc.)
- **Nouveau modele `SubscriptionNotification`** pour les alertes d'abonnement
- **Nouveau modele `Cart` / `CartItem`** pour le panier client
- **Nouveau modele `SubscriptionPackServiceManual`** pour les services manuels dans les packs
- **Nouveau modele `ClientPriceOverride`** pour les prix personnalises
- **Job Laravel `CheckSubscriptionExpiry`** pour les notifications programmees

---

## 2. Modelisation de la Base de Donnees

### 2.1 Nouvelle Table : `countries`

```sql
CREATE TABLE countries (
    id UUID PRIMARY KEY,
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
    phone_code VARCHAR(5),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

Donnees de reference :

| code | name | currency | phone_code |
|------|------|----------|------------|
| CMR | Cameroun | FCFA | +237 |
| CIV | Cote d'Ivoire | FCFA | +225 |

### 2.2 Nouvelle Table : `cities`

```sql
CREATE TABLE cities (
    id UUID PRIMARY KEY,
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE(country_id, name)
);
```

### 2.3 Modification de la Table `agencies`

```sql
ALTER TABLE agencies ADD COLUMN type ENUM('agency', 'academy') NOT NULL DEFAULT 'agency';
ALTER TABLE agencies ADD COLUMN country_id UUID NULL REFERENCES countries(id);
ALTER TABLE agencies ADD COLUMN city_id UUID NULL REFERENCES cities(id);
```

Les colonnes existantes `country` et `city` (VARCHAR) sont conservees pour compatibilite puis migrees vers les nouvelles FK.

### 2.4 Modification de la Table `users`

```sql
ALTER TABLE users ADD COLUMN client_category_id UUID NULL REFERENCES client_categories(id);
ALTER TABLE users ADD COLUMN country_id UUID NULL REFERENCES countries(id);
```

### 2.5 Nouvelle Table : `client_categories`

```sql
CREATE TABLE client_categories (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

### 2.6 Nouvelle Table : `subscription_notifications`

```sql
CREATE TABLE subscription_notifications (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    type ENUM('14_days', '7_days', '2_days', '1_day', 'expired') NOT NULL,
    sent_at TIMESTAMP NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    INDEX idx_sub_notif_type (subscription_id, type)
);
```

### 2.7 Nouvelle Table : `subscription_pack_service_manual`

```sql
CREATE TABLE subscription_pack_service_manual (
    id UUID PRIMARY KEY,
    subscription_pack_id UUID NOT NULL REFERENCES subscription_packs(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    price_per_month DECIMAL(12,2) NOT NULL DEFAULT 0,
    description TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

### 2.8 Nouvelle Table : `client_price_overrides`

```sql
CREATE TABLE client_price_overrides (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID NULL REFERENCES services(id) ON DELETE CASCADE,
    subscription_pack_id UUID NULL REFERENCES subscription_packs(id) ON DELETE CASCADE,
    custom_price DECIMAL(12,2) NOT NULL,
    reason TEXT NULL,
    created_by UUID NULL REFERENCES users(id),
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    CHECK (service_id IS NOT NULL OR subscription_pack_id IS NOT NULL),
    UNIQUE(client_id, service_id),
    UNIQUE(client_id, subscription_pack_id)
);
```

### 2.9 Nouvelles Tables : `carts` et `cart_items`

```sql
CREATE TABLE carts (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID NULL REFERENCES agencies(id),
    status ENUM('active', 'converted', 'abandoned') DEFAULT 'active',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    service_id UUID NULL REFERENCES services(id),
    subscription_pack_id UUID NULL REFERENCES subscription_packs(id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    custom_label VARCHAR(255) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    CHECK (service_id IS NOT NULL OR subscription_pack_id IS NOT NULL)
);
```

### 2.10 Nouvelle Table : `subscription_expiry_logs`

```sql
CREATE TABLE subscription_expiry_logs (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    notification_type ENUM('14_days', '7_days', '2_days', '1_day', 'expired') NOT NULL,
    sent_at TIMESTAMP NOT NULL,
    channel ENUM('email', 'sms', 'in_app', 'push') NOT NULL DEFAULT 'in_app',
    recipient_id UUID REFERENCES users(id),
    created_at TIMESTAMP NULL
);
```

### 2.11 Nouvelles Permissions

```sql
INSERT INTO permissions (id, name, created_at) VALUES
    (UUID(), 'notifications.consulter', NOW()),
    (UUID(), 'notifications.envoyer', NOW()),
    (UUID(), 'client-portal.acceder', NOW()),
    (UUID(), 'client-portal.panier', NOW()),
    (UUID(), 'client-portal.commander', NOW()),
    (UUID(), 'abonnements.notifier', NOW()),
    (UUID(), 'countries.consulter', NOW()),
    (UUID(), 'countries.creer', NOW()),
    (UUID(), 'countries.modifier', NOW()),
    (UUID(), 'countries.supprimer', NOW());
```

---

## 3. Module Abonnements

### 3.1 Filtres a Implementer

Filtres existants : `agency_id`, `client_id`, `pack_id`, `status`

Filtres a ajouter dans `SubscriptionController@index` :

| Parametre | Type | Description |
|-----------|------|-------------|
| `start_date_from` | date | Date de debut min |
| `start_date_to` | date | Date de debut max |
| `end_date_from` | date | Date de fin min |
| `end_date_to` | date | Date de fin max |
| `country_id` | uuid | Filtrer par pays |
| `city_id` | uuid | Filtrer par ville |
| `duration_min` | int | Duree minimum (mois) |
| `duration_max` | int | Duree maximum (mois) |
| `price_min` | float | Prix minimum |
| `price_max` | float | Prix maximum |
| `expiring_soon` | bool | Abonnements expirant dans les 30 jours |
| `is_expired` | bool | Abonnements expires |
| `search` | string | Recherche texte (nom client, nom pack) |

Filtre par statut : Actif / Expire / Annule / En attente

### 3.2 Filtres sur les Packs

| Parametre | Type | Description |
|-----------|------|-------------|
| `country_id` | uuid | Filtrer par pays |
| `is_active` | bool | Packs actifs/inactifs |
| `search` | string | Recherche par nom/description |
| `price_min` | float | Prix minimum/mois |
| `price_max` | float | Prix maximum/mois |

### 3.3 Code Backend - SubscriptionController@index modifie

```php
public function index(Request $request): JsonResponse
{
    $subscriptions = Subscription::query()
        ->with('pack', 'agency:id,name,country_id', 'client:id,first_name,last_name,email', 'invoice')
        ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
        ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
        ->when($request->pack_id, fn ($q, $id) => $q->where('subscription_pack_id', $id))
        ->when($request->country_id, fn ($q, $id) => $q->whereHas('agency', fn ($a) => $a->where('country_id', $id)))
        ->when($request->city_id, fn ($q, $id) => $q->whereHas('agency', fn ($a) => $a->where('city_id', $id)))
        ->when($request->start_date_from, fn ($q, $d) => $q->where('start_date', '>=', $d))
        ->when($request->start_date_to, fn ($q, $d) => $q->where('start_date', '<=', $d))
        ->when($request->end_date_from, fn ($q, $d) => $q->where('end_date', '>=', $d))
        ->when($request->end_date_to, fn ($q, $d) => $q->where('end_date', '<=', $d))
        ->when($request->duration_min, fn ($q, $d) => $q->where('months', '>=', $d))
        ->when($request->duration_max, fn ($q, $d) => $q->where('months', '<=', $d))
        ->when($request->expiring_soon === 'true', fn ($q) => $q->where('end_date', '<=', now()->addDays(30))->where('end_date', '>=', now()))
        ->when($request->is_expired === 'true', fn ($q) => $q->where('end_date', '<', now()))
        ->when($request->search, function ($q, $search) {
            $q->whereHas('client', fn ($c) => $c->where('first_name', 'like', "%{$search}%")->orWhere('last_name', 'like', "%{$search}%"))
              ->orWhereHas('pack', fn ($p) => $p->where('name', 'like', "%{$search}%"));
        })
        ->when($request->status, function ($q, $status) {
            $q->whereHas('invoice', fn ($i) => $status === 'cancelled'
                ? $i->whereNotNull('cancelled_at')
                : $i->whereNull('cancelled_at')->where('status', $status));
        })
        ->orderByDesc('start_date')
        ->paginate(min((int) $request->input('per_page', 15), 100));

    return response()->json($subscriptions);
}
```

---

## 4. Systeme de Notifications

### 4.1 Strategie de Notification

| Evenement | Delai | Canal |
|-----------|-------|-------|
| Fin d'abonnement dans 14 jours | J-14 | Email + In-App |
| Fin d'abonnement dans 7 jours | J-7 | Email + In-App + SMS |
| Fin d'abonnement dans 2 jours | J-2 | Email + In-App + SMS |
| Fin d'abonnement demain | J-1 | Email + In-App + SMS |
| Abonnement expire | J-0 | Email + In-App + SMS |

### 4.2 Backend - Job `CheckSubscriptionExpiry`

Fichier : `app/Jobs/CheckSubscriptionExpiry.php`

```php
<?php

namespace App\Jobs;

use App\Models\Subscription;
use App\Models\SubscriptionNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class CheckSubscriptionExpiry implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function handle(): void
    {
        $checks = [
            ['days' => 14, 'type' => '14_days'],
            ['days' => 7,  'type' => '7_days'],
            ['days' => 2,  'type' => '2_days'],
            ['days' => 1,  'type' => '1_day'],
            ['days' => 0,  'type' => 'expired'],
        ];

        foreach ($checks as $check) {
            $date = Carbon::now()->addDays($check['days'])->toDateString();

            $subscriptions = Subscription::where('end_date', $date)
                ->whereHas('invoice', fn ($q) => $q->whereNull('cancelled_at'))
                ->with('client', 'pack')
                ->get();

            foreach ($subscriptions as $sub) {
                $exists = SubscriptionNotification::where('subscription_id', $sub->id)
                    ->where('type', $check['type'])
                    ->exists();

                if ($exists) continue;

                SubscriptionNotification::create([
                    'subscription_id' => $sub->id,
                    'type' => $check['type'],
                    'sent_at' => now(),
                ]);

                if ($sub->client && $sub->client->email) {
                    // Mail::to($sub->client)->send(
                    //     new SubscriptionExpiryMail($sub, $check['type'])
                    // );
                }
            }
        }
    }
}
```

### 4.3 Planification du Job

Fichier : `routes/console.php`

```php
use App\Jobs\CheckSubscriptionExpiry;
use Illuminate\Support\Facades\Schedule;

Schedule::job(new CheckSubscriptionExpiry)->dailyAt('08:00');
```

### 4.4 Endpoints API Notifications

Nouvelles routes dans `api.php` :

```php
Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);
```

### 4.5 Frontend - Composant NotificationBell

- Icone de cloche dans la navbar avec compteur non-lus
- Dropdown listant les notifications recentes
- Page `/notifications` avec liste complete et pagination
- Toast automatique quand une notification arrive

### 4.6 Modele SubscriptionNotification

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionNotification extends Model
{
    use HasUuids;

    protected $fillable = [
        'subscription_id',
        'type',
        'sent_at',
        'is_read',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function markAsRead(): void
    {
        $this->update(['is_read' => true, 'read_at' => now()]);
    }
}
```

---

## 5. Renommer Equipes vers Utilisateurs

### 5.1 Backend

- Renommer la route : `/agencies/{agencyId}/teams` vers `/agencies/{agencyId}/users`
- Renommer le composant : `AgencyTeamsPage` vers `AgencyUsersPage`
- Mettre a jour les labels dans les controleurs et les reponses API
- Pas de changement de table : la table `user_assignments` reste identique

### 5.2 Frontend

| Ancien | Nouveau |
|--------|---------|
| `AgencyTeamsPage.tsx` | `AgencyUsersPage.tsx` |
| Route `/agencies/:agencyId/teams` | Route `/agencies/:agencyId/users` |
| Label "Equipes" | Label "Utilisateurs" |
| Label "Membres de l'equipe" | Label "Utilisateurs assignes" |

### 5.3 Traductions i18n

```json
{
  "agencies.teams": "Utilisateurs",
  "agencies.teamsSubtitle": "Gestion des utilissateurs assignes a cette agence",
  "agencies.teams.addMember": "Ajouter un utilisateur",
  "agencies.teams.removeMember": "Retirer cet utilisateur"
}
```

---

## 6. Filtres Commercial et Produits

### 6.1 Meilleur Commercial - Filtres Temporels

Backend - `CommercialController@ranking` modifie :

```php
public function ranking(Request $request): JsonResponse
{
    $period = $request->input('period', 'month');
    $dateFrom = $request->input('date_from');
    $dateTo = $request->input('date_to');
    $agencyId = $request->input('agency_id');

    $query = Commercial::query()
        ->with('user:id,first_name,last_name')
        ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId));

    $query->withCount(['invoices as total_sales' => function ($q) use ($period, $dateFrom, $dateTo) {
        $q->where('status', 'paid')->whereNull('cancelled_at');
        $this->applyPeriodFilter($q, $period, $dateFrom, $dateTo, 'invoice_date');
    }]);

    $query->withSum(['invoices as total_revenue' => function ($q) use ($period, $dateFrom, $dateTo) {
        $q->where('status', 'paid')->whereNull('cancelled_at');
        $this->applyPeriodFilter($q, $period, $dateFrom, $dateTo, 'invoice_date');
    }], 'total_amount');

    $ranking = $query->orderByDesc('total_revenue')
        ->orderByDesc('total_sales')
        ->limit(20)
        ->get();

    return response()->json($ranking);
}

private function applyPeriodFilter($query, string $period, ?string $dateFrom, ?string $dateTo, string $column): void
{
    if ($dateFrom && $dateTo) {
        $query->whereBetween($column, [$dateFrom, $dateTo]);
        return;
    }

    match ($period) {
        'day'    => $query->whereDate($column, now()->toDateString()),
        'week'   => $query->where($column, '>=', now()->startOfWeek()),
        'month'  => $query->where($column, '>=', now()->startOfMonth()),
        'year'   => $query->where($column, '>=', now()->startOfYear()),
        default  => null,
    };
}
```

Periodes supportees : `day`, `week`, `month`, `year`, `custom` (avec date_from + date_to).

### 6.2 Produits les Plus Vendus

Nouvel endpoint `StatsController@topProducts` :

```php
public function topProducts(Request $request): JsonResponse
{
    $period = $request->input('period', 'month');
    $dateFrom = $request->input('date_from');
    $dateTo = $request->input('date_to');
    $agencyId = $request->input('agency_id');
    $limit = min((int) $request->input('limit', 10), 50);

    $topProducts = InvoiceItem::query()
        ->selectRaw('service_id, label, SUM(quantity) as total_qty, SUM(line_total) as total_revenue')
        ->whereHas('invoice', function ($q) use ($agencyId, $period, $dateFrom, $dateTo) {
            $q->where('status', 'paid')->whereNull('cancelled_at');
            if ($agencyId) $q->where('agency_id', $agencyId);
            $this->applyPeriodFilter($q, $period, $dateFrom, $dateTo, 'invoice_date');
        })
        ->groupBy('service_id', 'label')
        ->orderByDesc('total_revenue')
        ->limit($limit)
        ->get();

    return response()->json($topProducts);
}
```

Nouvelle route :

```php
Route::get('/stats/top-products', [StatsController::class, 'topProducts'])
    ->middleware('permission:stats.consulter');
```

---

## 7. Authentification Dissociee Client / Admin

### 7.1 Architecture des Routes

```
/login              -> Page de connexion Admin/Employe
/client/login       -> Page de connexion Client
```

### 7.2 Backend - ClientLoginController

Fichier : `app/Http/Controllers/Api/Auth/ClientLoginController.php`

```php
<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ClientLoginController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $request->email)
            ->whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Les identifiants sont incorrects.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Votre compte est desactive.'],
            ]);
        }

        $token = $user->createToken('client-token')->plainTextToken;

        return response()->json([
            'user' => $user->load('role'),
            'token' => $token,
        ]);
    }
}
```

### 7.3 Route API

```php
Route::post('/auth/client/login', ClientLoginController::class);
```

### 7.4 Frontend - Page ClientLoginPage

Fichier : `src/pages/auth/ClientLoginPage.tsx`

- Design different de la page admin (branding PEKEGNO client)
- Aucun lien vers la page admin visible
- Formulaire : email + mot de passe
- Lien "Mot de passe oublie ?"
- Redirection vers `/client` apres connexion

### 7.5 Middleware de Securite

Fichier : `app/Http/Middleware/ClientBlockedMiddleware.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ClientBlockedMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()?->role?->name === 'client') {
            return response()->json(['message' => 'Acces non autorise.'], 403);
        }
        return $next($request);
    }
}
```

Fichier : `app/Http/Middleware/ClientOnlyMiddleware.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ClientOnlyMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()?->role?->name !== 'client') {
            return response()->json(['message' => 'Acces reserve aux clients.'], 403);
        }
        return $next($request);
    }
}
```

### 7.6 Application des Middlewares

```php
// Routes admin - clients bloques
Route::middleware(['auth:sanctum', 'client.blocked'])->group(function () {
    // Toutes les routes existantes (agencies, services, invoices, etc.)
});

// Routes client uniquement
Route::middleware(['auth:sanctum', 'client.only'])->prefix('client')->group(function () {
    // Routes du portail client
});
```

---

## 8. Portail Client (Catalogue + Panier)

### 8.1 Catalogue Public (sans auth)

Routes API :

```php
Route::get('/client/catalog/services', [ClientCatalogController::class, 'services']);
Route::get('/client/catalog/services/{service}', [ClientCatalogController::class, 'serviceDetail']);
Route::get('/client/catalog/packs', [ClientCatalogController::class, 'packs']);
Route::get('/client/catalog/packs/{pack}', [ClientCatalogController::class, 'packDetail']);
Route::get('/client/catalog/categories', [ClientCatalogController::class, 'categories']);
```

### 8.2 Panier Client

Routes API (authentification client requise) :

```php
Route::middleware(['auth:sanctum', 'client.only'])->prefix('client/cart')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::post('/items', [CartController::class, 'addItem']);
    Route::put('/items/{item}', [CartController::class, 'updateItem']);
    Route::delete('/items/{item}', [CartController::class, 'removeItem']);
    Route::delete('/', [CartController::class, 'clear']);
    Route::post('/checkout', [CartController::class, 'checkout']);
});
```

### 8.3 Conversion Panier -> Facture

Le checkout du panier genere automatiquement une facture :
- Le panier passe au statut `converted`
- Chaque item devient une ligne de facture (`InvoiceItem`)
- Le client recoit une facture avec le statut `unpaid`

### 8.4 Frontend - Pages Client

Nouvelles pages dans `src/pages/client/` :

| Page | Route | Description |
|------|-------|-------------|
| `ClientPortalLayout.tsx` | `/client` | Layout du portail client |
| `ClientCatalogPage.tsx` | `/client/catalog` | Catalogue des services/packs |
| `ClientServiceDetailPage.tsx` | `/client/catalog/services/:id` | Detail d'un service |
| `ClientPackDetailPage.tsx` | `/client/catalog/packs/:id` | Detail d'un pack |
| `ClientCartPage.tsx` | `/client/cart` | Panier |
| `ClientInvoicesPage.tsx` | `/client/invoices` | Mes factures |
| `ClientSubscriptionsPage.tsx` | `/client/subscriptions` | Mes abonnements |
| `ClientProfilePage.tsx` | `/client/profile` | Mon profil |

---

## 9. Rapport Commercial - Filtres Date

### 9.1 Filtre Temporel dans CommercialReportController

Le controller `CommercialReportController@report` doit accepter :

| Parametre | Type | Description |
|-----------|------|-------------|
| `period` | string | `day`, `week`, `month`, `year`, `custom` |
| `date_from` | date | Date de debut (si custom) |
| `date_to` | date | Date de fin (si custom) |
| `agency_id` | uuid | Filtrer par agence |
| `commercial_id` | uuid | Filtrer par commercial specifique |

### 9.2 Prise en Compte des Services Seminaires

Dans les items de facture, un meme service seminaire peut apparaitre sur plusieurs lignes (ex: differentes sessions). Le filtre doit comptabiliser chaque ligne separement ou regrouper par `service_id` + `seminar_tier_id`.

### 9.3 Code Backend

```php
public function report(Request $request): JsonResponse
{
    $period = $request->input('period', 'month');
    $dateFrom = $request->input('date_from');
    $dateTo = $request->input('date_to');
    $agencyId = $request->input('agency_id');
    $commercialId = $request->input('commercial_id');

    $query = Invoice::query()
        ->with(['items', 'payments', 'commercial'])
        ->where('status', '!=', 'cancelled')
        ->whereNull('cancelled_at');

    $this->applyPeriodFilter($query, $period, $dateFrom, $dateTo, 'invoice_date');

    if ($agencyId) $query->where('agency_id', $agencyId);
    if ($commercialId) $query->where('commercial_id', $commercialId);

    $invoices = $query->orderByDesc('invoice_date')->paginate(50);

    $summary = [
        'total_invoices' => $invoices->total(),
        'total_revenue' => $invoices->getCollection()->sum('total_amount'),
        'total_paid' => $invoices->getCollection()->sum('amount_paid'),
        'total_commission' => $invoices->getCollection()->sum('commission_amount'),
    ];

    return response()->json(['invoices' => $invoices, 'summary' => $summary]);
}
```

---

## 10. Separation Geographique

### 10.1 Structure PEKEGNO Group

```
PEKEGNO Group
  |-- PEKEGNO Cameroon
  |     |-- Agences (Douala, Yaounde, etc.)
  |     |     |-- Agency (produits, ventes)
  |     |     |-- Academy (formations)
  |-- PEKEGNO Cote d'Ivoire
  |     |-- Agences (Abidjan, etc.)
  |     |     |-- Agency (produits, ventes)
  |     |     |-- Academy (formations)
```

### 10.2 Dashboard PEKEGNO Group

Le dashboard principal (`AdminDashboardPage.tsx`) affiche :
- Stats globales PEKEGNO Group (tous pays)
- Onglet "Cameroun" avec stats par agences
- Onglet "Cote d'Ivoire" avec stats par agences

### 10.3 Backend - Stats Filrees par Pays

Modifier `StatsController@overview` :

```php
public function overview(Request $request): JsonResponse
{
    $countryId = $request->input('country_id');
    $agencyId = $request->input('agency_id');
    $period = $request->input('period', 'month');
    $dateFrom = $request->input('date_from');
    $dateTo = $request->input('date_to');

    $invoiceQuery = Invoice::where('status', 'paid')->whereNull('cancelled_at');
    $this->applyPeriodFilter($invoiceQuery, $period, $dateFrom, $dateTo, 'invoice_date');

    if ($countryId) {
        $invoiceQuery->whereHas('agency', fn ($q) => $q->where('country_id', $countryId));
    }
    if ($agencyId) {
        $invoiceQuery->where('agency_id', $agencyId);
    }

    $totalRevenue = (clone $invoiceQuery)->sum('total_amount');
    $totalInvoices = (clone $invoiceQuery)->count();
    $totalClients = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
        ->when($countryId, fn ($q) => $q->where('country_id', $countryId))
        ->count();

    return response()->json([
        'total_revenue' => $totalRevenue,
        'total_invoices' => $totalInvoices,
        'total_clients' => $totalClients,
    ]);
}
```

---

## 11. Structure Agency / Academy

### 11.1 Champ `type` sur `agencies`

L'ajout du champ `type ENUM('agency', 'academy')` dans la table `agencies` permet de distinguer :

- **Agency** : Vente de produits physiques (appareils electroniques, livres, etc.) + services digitaux
- **Academy** : Formations en ligne ou en presentiel, avec formateurs et apprenants

### 11.2 Modele Agency modifie

```php
class Agency extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code', 'name', 'type', 'country', 'city',
        'address', 'phone', 'email',
        'country_id', 'city_id',
    ];

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function isAgency(): bool
    {
        return $this->type === 'agency';
    }

    public function isAcademy(): bool
    {
        return $this->type === 'academy';
    }
}
```

### 11.3 Frontend - Filtrage par Type

Dans `AgencyListPage.tsx`, ajouter un filtre :
- Toutes / Agency / Academy

Les pages d'agence s'adaptent selon le type :
- **Agency** : afficher services, ventes, factures, clients
- **Academy** : afficher formations, formateurs, apprenants, seminaires

### 11.4 Modele Trainer (pour Academy)

Nouvelle table `trainers` :

```sql
CREATE TABLE trainers (
    id UUID PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    speciality VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

### 11.5 Modele Learner (pour Academy)

La table `users` avec `client_category_id` fait office d'apprenant. Les apprenants sont des clients avec la categorie "apprenant".

---

## 12. Categorisation des Clients

### 12.1 Categories de Clients

| Slug | Description |
|------|-------------|
| `apprenant` | Client inscrit a une formation (Academy) |
| `abonne` | Client avec un abonnement actif |
| `prospect` | Prospection commerciale (deja existe via `prospects`) |
| `autre` | Autre type de client |

### 12.2 Ajout dans User

```php
// Migration
Schema::table('users', function (Blueprint $table) {
    $table->uuid('client_category_id')->nullable()->after('role_id');
    $table->foreign('client_category_id')->references('id')->on('client_categories')->nullOnDelete();
    $table->uuid('country_id')->nullable()->after('country');
    $table->foreign('country_id')->references('id')->on('countries')->nullOnDelete();
});
```

### 12.3 Modele ClientCategory

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientCategory extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'slug', 'description', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'client_category_id');
    }
}
```

### 12.4 Filtre par Categorie Client

Dans `ClientController@index` :

```php
->when($request->client_category_id, fn ($q, $id) => $q->where('client_category_id', $id))
```

Frontend : ajouter un select "Categorie" dans les filtres de la page clients.

---

## 13. Table des Pays en Base

### 13.1 Modele Country

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Country extends Model
{
    use HasUuids;

    protected $fillable = ['code', 'name', 'currency', 'phone_code', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function cities(): HasMany
    {
        return $this->hasMany(City::class);
    }

    public function agencies(): HasMany
    {
        return $this->hasMany(Agency::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
```

### 13.2 Modele City

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class City extends Model
{
    use HasUuids;

    protected $fillable = ['country_id', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }
}
```

### 13.3 Seeders

```php
// CountrySeeder
Country::create(['code' => 'CMR', 'name' => 'Cameroun', 'currency' => 'FCFA', 'phone_code' => '+237']);
Country::create(['code' => 'CIV', 'name' => "Cote d'Ivoire", 'currency' => 'FCFA', 'phone_code' => '+225']);

// CitySeeder
$cmr = Country::where('code', 'CMR')->first();
$civ = Country::where('code', 'CIV')->first();

City::insert([
    ['country_id' => $cmr->id, 'name' => 'Douala'],
    ['country_id' => $cmr->id, 'name' => 'Yaounde'],
    ['country_id' => $cmr->id, 'name' => 'Bamenda'],
    ['country_id' => $civ->id, 'name' => 'Abidjan'],
    ['country_id' => $civ->id, 'name' => 'Bouake'],
]);
```

---

## 14. Services Manuels dans les Abonnements

### 14.1 Besoin

Lors de la creation d'un pack d'abonnement, on doit pouvoir ajouter des services **sans les selectionner dans la base existante**. Exemples :
- "Gestion de page Facebook"
- "Campagne publicitaire TikTok"
- "Maintenance electronique"

Ces services manuels ont un libelle libre et un prix mensuel defini a la creation.

### 14.2 Modele SubscriptionPackServiceManual

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPackServiceManual extends Model
{
    use HasUuids;

    protected $fillable = [
        'subscription_pack_id',
        'label',
        'price_per_month',
        'description',
    ];

    protected function casts(): array
    {
        return ['price_per_month' => 'decimal:2'];
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'subscription_pack_id');
    }
}
```

### 14.3 Modification du SubscriptionPack

```php
// SubscriptionPack ajouter :
public function manualServices(): HasMany
{
    return $this->hasMany(SubscriptionPackServiceManual::class);
}
```

### 14.4 Modification du Controller

Dans `SubscriptionController@validatePack` :

```php
$rules = [
    'name' => ['required', 'string', 'max:255'],
    'description' => ['nullable', 'string', 'max:2000'],
    'price_per_month' => ['required', 'numeric', 'min:0'],
    'is_active' => ['sometimes', 'boolean'],
    'agency_id' => ['nullable', 'exists:agencies,id'],
    'services' => ['sometimes', 'array'],
    'services.*.service_id' => ['required', 'uuid', 'exists:services,id'],
    'manual_services' => ['sometimes', 'array'],
    'manual_services.*.label' => ['required', 'string', 'max:255'],
    'manual_services.*.price_per_month' => ['required', 'numeric', 'min:0'],
    'manual_services.*.description' => ['nullable', 'string', 'max:1000'],
];
```

---

## 15. Prix Personnalisables par Client

### 15.1 Besoin

Le prix d'un abonnement ou d'un service doit pouvoir etre modifie pour un client particulier. Exemple : un client fidele bénéficie d'un tarif reduit.

### 15.2 Modele ClientPriceOverride

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientPriceOverride extends Model
{
    use HasUuids;

    protected $fillable = [
        'client_id',
        'service_id',
        'subscription_pack_id',
        'custom_price',
        'reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return ['custom_price' => 'decimal:2'];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function pack(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'subscription_pack_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
```

### 15.3 Application du Prix Personnalise

Dans `SubscriptionController@store` :

```php
// Determiner le prix effectif pour ce client
$pricePerMonth = (float) $pack->price_per_month;

$override = ClientPriceOverride::where('client_id', $client->id)
    ->where('subscription_pack_id', $pack->id)
    ->first();

if ($override) {
    $pricePerMonth = (float) $override->custom_price;
}
```

### 15.4 Routes API

```php
Route::get('/clients/{client}/price-overrides', [ClientPriceOverrideController::class, 'index']);
Route::post('/clients/{client}/price-overrides', [ClientPriceOverrideController::class, 'store']);
Route::put('/clients/{client}/price-overrides/{override}', [ClientPriceOverrideController::class, 'update']);
Route::delete('/clients/{client}/price-overrides/{override}', [ClientPriceOverrideController::class, 'destroy']);
```

---

## 16. Selecteur de Periode pour les Stats

### 16.1 Besoin

Pouvoir modifier la periode d'affichage des stats : "Cette periode : 01/08/2026 -> 19/08/2026" et pouvoir la changer pour afficher des stats sur des periodes precises.

### 16.2 Backend - Parametres de Periode

Tous les endpoints `stats/*` et `bilans` doivent accepter :

| Parametre | Type | Description |
|-----------|------|-------------|
| `period` | string | `today`, `week`, `month`, `quarter`, `year`, `custom` |
| `date_from` | date | Date debut (si custom) |
| `date_to` | date | Date fin (si custom) |
| `country_id` | uuid | Filtrer par pays |
| `agency_id` | uuid | Filtrer par agence |

### 16.3 Frontend - Composant PeriodSelector

Nouveau composant `src/components/ui/PeriodSelector.tsx` :

```tsx
interface PeriodSelectorProps {
  value: string;
  dateFrom: string;
  dateTo: string;
  onChange: (period: string, dateFrom: string, dateTo: string) => void;
}

const PRESETS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Cette semaine', value: 'week' },
  { label: 'Ce mois', value: 'month' },
  { label: 'Ce trimestre', value: 'quarter' },
  { label: 'Cette annee', value: 'year' },
  { label: 'Personnalise', value: 'custom' },
];
```

Integrer ce composant dans :
- `AdminDashboardPage.tsx`
- `AgencyOverviewPage.tsx`
- `DailyBilanPage.tsx`
- `CommercialReportPage.tsx`
- `AccountingPage.tsx`

---

## 17. Filtres sur Toutes les Pages de Listes

### 17.1 Principe

Toute page de liste dans la plateforme doit permettre de filtrer depuis **tous les champs affiches**. Cela concerne :

| Page | Filtres a ajouter |
|------|-------------------|
| Clients | Categorie, pays, ville, date inscription, statut |
| Services | Categorie, agence, type (seminar/non), prix |
| Factures | Statut, date, agence, commercial, type paiement |
| Commercials | Agence, statut actif/inactif, type |
| Agences | Pays, ville, type (agency/academy) |
| Categories | Recherche texte |
| Abonnements | Package, date, statut, duree, pays |
| Comptabilite | Type transaction, categorie, date |
| Bilans | Date, agence |
| Prospects | Commercial, statut, date |

### 17.2 Pattern Backend pour Tous les Controllers

```php
// Dans chaque controller index()
->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%"))
->when($request->country_id, fn ($q, $id) => $q->where('country_id', $id))
->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
->when($request->date_from, fn ($q, $d) => $q->where('created_at', '>=', $d))
->when($request->date_to, fn ($q, $d) => $q->where('created_at', '<=', $d))
```

### 17.3 Pattern Frontend

Chaque page de liste aura un composant `FilterBar` contenant :
- Champ de recherche texte
- Selecteurs dependants (pays -> ville)
- Champs date (debut/fin)
- Selecteurs de statut
- Bouton "Reinitialiser les filtres"
- Les filtres sont synchronises avec l'URL via `useSearchParams`

---

## 18. Recapitulatif des Modifications Backend

### 18.1 Nouveaux Modeles

| Modele | Table | Description |
|--------|-------|-------------|
| `Country` | `countries` | Pays (Cameroun, Cote d'Ivoire) |
| `City` | `cities` | Villes rattachees aux pays |
| `ClientCategory` | `client_categories` | Categories de clients |
| `SubscriptionNotification` | `subscription_notifications` | Notifications d'expiration |
| `SubscriptionPackServiceManual` | `subscription_pack_service_manual` | Services manuels dans les packs |
| `ClientPriceOverride` | `client_price_overrides` | Prix personnalises par client |
| `Cart` | `carts` | Panier client |
| `CartItem` | `cart_items` | Articles du panier |
| `Trainer` | `trainers` | Formateurs (Academy) |

### 18.2 Nouveaux Controleurs

| Controleur | Description |
|------------|-------------|
| `ClientLoginController` | Authentification client |
| `NotificationController` | CRUD notifications |
| `ClientCatalogController` | Catalogue public |
| `CartController` | Panier client |
| `ClientPriceOverrideController` | Prix personnalises |
| `CountryController` | Gestion des pays |
| `CityController` | Gestion des villes |
| `ClientCategoryController` | Gestion des categories |

### 18.3 Nouveaux Middlewares

| Middleware | Description |
|------------|-------------|
| `ClientBlockedMiddleware` | Empeche les clients d'acceder aux routes admin |
| `ClientOnlyMiddleware` | Autorise uniquement les clients |

### 18.4 Nouveaux Jobs

| Job | Description |
|-----|-------------|
| `CheckSubscriptionExpiry` | Verifie et notifie les abonnements expirants |

### 18.5 Controllers a Modifier

| Controller | Modifications |
|------------|---------------|
| `SubscriptionController` | Filtres etendus, services manuels, prix personnalises |
| `CommercialController` | Filtres temporels sur le ranking |
| `CommercialReportController` | Filtres date (jour/semaine/mois/annee/custom) |
| `StatsController` | Filtres pays, periode, top produits |
| `ClientController` | Filtres categorie, pays |
| `AgencyController` | Filtres type (agency/academy), pays, ville |
| `InvoiceController` | Filtres date etendus |
| `ServiceController` | Filtres type, categorie, agence |

### 18.6 Nouvelles Routes dans `api.php`

```php
// Auth client
Route::post('/auth/client/login', ClientLoginController::class);

// Notifications
Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

// Catalogue client (public)
Route::get('/client/catalog/services', [ClientCatalogController::class, 'services']);
Route::get('/client/catalog/packs', [ClientCatalogController::class, 'packs']);
Route::get('/client/catalog/categories', [ClientCatalogController::class, 'categories']);

// Panier client
Route::middleware(['auth:sanctum', 'client.only'])->prefix('client/cart')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::post('/items', [CartController::class, 'addItem']);
    Route::put('/items/{item}', [CartController::class, 'updateItem']);
    Route::delete('/items/{item}', [CartController::class, 'removeItem']);
    Route::post('/checkout', [CartController::class, 'checkout']);
});

// Pays et villes
Route::apiResource('countries', CountryController::class);
Route::apiResource('countries/{country}/cities', CityController::class);

// Categories clients
Route::apiResource('client-categories', ClientCategoryController::class);

// Prix personnalises
Route::apiResource('clients/{client}/price-overrides', ClientPriceOverrideController::class);

// Stats etendues
Route::get('/stats/top-products', [StatsController::class, 'topProducts']);
```

---

## 19. Recapitulatif des Modifications Frontend

### 19.1 Nouvelles Pages

| Page | Route | Description |
|------|-------|-------------|
| `ClientLoginPage.tsx` | `/client/login` | Connexion client |
| `ClientPortalLayout.tsx` | `/client` | Layout portail client |
| `ClientCatalogPage.tsx` | `/client/catalog` | Catalogue |
| `ClientServiceDetailPage.tsx` | `/client/catalog/services/:id` | Detail service |
| `ClientPackDetailPage.tsx` | `/client/catalog/packs/:id` | Detail pack |
| `ClientCartPage.tsx` | `/client/cart` | Panier |
| `ClientInvoicesPage.tsx` | `/client/invoices` | Mes factures |
| `ClientSubscriptionsPage.tsx` | `/client/subscriptions` | Mes abonnements |
| `ClientProfilePage.tsx` | `/client/profile` | Mon profil |
| `NotificationsPage.tsx` | `/notifications` | Notifications |
| `CountryListPage.tsx` | `/countries` | Gestion des pays |

### 19.2 Pages a Modifier

| Page | Modifications |
|------|---------------|
| `SubscriptionListPage.tsx` | Filtres etendus (pays, date, duree, statut, recherche) |
| `AgencyTeamsPage.tsx` | Renommer en `AgencyUsersPage.tsx` |
| `CommercialReportPage.tsx` | Filtres temporels, top produits |
| `AdminDashboardPage.tsx` | Selecteur de periode, filtres pays |
| `AgencyOverviewPage.tsx` | Selecteur de periode, filtres pays |
| `ClientListPage.tsx` | Filtres categorie, pays |
| `AgencyListPage.tsx` | Filtre type (agency/academy), pays |
| `LoginPage.tsx` | Ajouter lien vers `/client/login` (discret) |

### 19.3 Nouveaux Composants

| Composant | Description |
|-----------|-------------|
| `PeriodSelector.tsx` | Selecteur de periode reutilisable |
| `NotificationBell.tsx` | Cloche de notification dans la navbar |
| `NotificationDropdown.tsx` | Dropdown des notifications |
| `FilterBar.tsx` | Barre de filtres reutilisable |
| `CountrySelect.tsx` | Selecteur de pays |
| `CitySelect.tsx` | Selecteur de ville (depend du pays) |
| `CartItemCard.tsx` | Carte d'article dans le panier |

### 19.4 Modifications du Router

```tsx
// Nouvelles routes
{ path: '/client/login', element: page(<ClientLoginPage />, form) },
{
  path: '/client',
  element: <ClientPortalLayout />,
  children: [
    { path: 'catalog', element: page(<ClientCatalogPage />, cards) },
    { path: 'catalog/services/:id', element: page(<ClientServiceDetailPage />, detail) },
    { path: 'catalog/packs/:id', element: page(<ClientPackDetailPage />, detail) },
    { path: 'cart', element: page(<ClientCartPage />, table) },
    { path: 'invoices', element: page(<ClientInvoicesPage />, table) },
    { path: 'subscriptions', element: page(<ClientSubscriptionsPage />, table) },
    { path: 'profile', element: page(<ClientProfilePage />, detail) },
  ],
},
{ path: '/notifications', element: page(<NotificationsPage />, table) },
{ path: '/countries', element: page(<CountryListPage />, table) },

// Route renommee
{ path: '/agencies/:agencyId/users', element: page(<AgencyUsersPage />, table) },
// Ancienne route redirigee
{ path: '/agencies/:agencyId/teams', element: <Navigate to="..." replace /> },
```

### 19.5 Traductions i18n a Ajouter

```json
{
  "client.auth.loginTitle": "Connexion Client PEKEGNO",
  "client.auth.loginSubtitle": "Accedez a votre espace client",
  "client.catalog.title": "Catalogue",
  "client.catalog.services": "Services",
  "client.catalog.packs": "Packs d'abonnement",
  "client.cart.title": "Mon Panier",
  "client.cart.empty": "Votre panier est vide",
  "client.cart.checkout": "Passer la commande",
  "client.invoices.title": "Mes Factures",
  "client.subscriptions.title": "Mes Abonnements",
  "notifications.title": "Notifications",
  "notifications.markAllRead": "Tout marquer comme lu",
  "notifications.empty": "Aucune notification",
  "filters.period": "Periode",
  "filters.period.today": "Aujourd'hui",
  "filters.period.week": "Cette semaine",
  "filters.period.month": "Ce mois",
  "filters.period.quarter": "Ce trimestre",
  "filters.period.year": "Cette annee",
  "filters.period.custom": "Personnalise",
  "filters.country": "Pays",
  "filters.city": "Ville",
  "filters.category": "Categorie",
  "filters.status": "Statut",
  "filters.dateFrom": "Du",
  "filters.dateTo": "Au",
  "filters.reset": "Reinitialiser",
  "agencies.type.agency": "Agency",
  "agencies.type.academy": "Academy"
}
```

---

## 20. Planning d'Implementation

### Phase 1 : Fondations (Semaine 1)

1. Creer les tables `countries`, `cities`, `client_categories` + seeders
2. Migration `agencies` : ajouter `type`, `country_id`, `city_id`
3. Migration `users` : ajouter `client_category_id`, `country_id`
4. Creer les modeles `Country`, `City`, `ClientCategory`
5. Modifier les modeles `Agency`, `User` avec les nouvelles relations

### Phase 2 : Auth Client (Semaine 1-2)

1. Creer `ClientLoginController` + route
2. Creer `ClientBlockedMiddleware` + `ClientOnlyMiddleware`
3. Creer `ClientLoginPage.tsx`
4. Configurer le router pour les routes client
5. Tester l'isolation complete admin/client

### Phase 3 : Notifications (Semaine 2)

1. Creer la table `subscription_notifications`
2. Creer le modele `SubscriptionNotification`
3. Creer le job `CheckSubscriptionExpiry`
4. Planifier le job dans `console.php`
5. Creer `NotificationController` + routes
6. Creer `NotificationBell.tsx` + `NotificationDropdown.tsx`
7. Creer `NotificationsPage.tsx`

### Phase 4 : Filtres Abonnements (Semaine 2-3)

1. Modifier `SubscriptionController@index` avec tous les filtres
2. Modifier `SubscriptionListPage.tsx` avec la nouvelle barre de filtres
3. Modifier les filtres sur les packs

### Phase 5 : Portail Client (Semaine 3-4)

1. Creer `ClientCatalogController` + routes
2. Creer `CartController` + routes
3. Creer les tables `carts`, `cart_items`
4. Creer les modeles `Cart`, `CartItem`
5. Creer toutes les pages client (catalogue, panier, factures, abonnements, profil)
6. Modifier le router

### Phase 6 : Separation Geographique + Agency/Academy (Semaine 4-5)

1. Modifier `StatsController` avec filtres pays/periode
2. Creer `PeriodSelector.tsx`
3. Modifier `AdminDashboardPage.tsx` avec le selecteur de periode
4. Modifier `AgencyListPage.tsx` avec filtre type
5. Creer `Trainer` model + migration
6. Adapter les pages d'agence selon le type

### Phase 7 : Filtres Avances (Semaine 5-6)

1. Modifier `CommercialController@ranking` avec filtres temporels
2. Creer `StatsController@topProducts`
3. Modifier `CommercialReportController` avec filtres date
4. Ajouter `FilterBar.tsx` reutilisable
5. Appliquer les filtres sur toutes les pages de listes

### Phase 8 : Prix Personnalises + Services Manuels (Semaine 6)

1. Creer `client_price_overrides` table + modele
2. Creer `subscription_pack_service_manual` table + modele
3. Modifier `SubscriptionController` pour services manuels + prix personnalises
4. Modifier le formulaire de creation de pack

### Phase 9 : Renommage Equipes (Semaine 6)

1. Renommer `AgencyTeamsPage` en `AgencyUsersPage`
2. Modifier les routes
3. Mettre a jour les traductions

### Phase 10 : Tests et Deploiement (Semaine 7)

1. Tests unitaires pour tous les nouveaux controllers
2. Tests d'integration pour les flux client
3. Tests de securite (isolation admin/client)
4. Deploiement staging
5. Deploiement production
