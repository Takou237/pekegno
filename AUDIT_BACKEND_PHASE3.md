# Audit Phase 3 — Backend (PEKEGNO)

> Statut détaillé des tâches du plan (`PLAN_TRAVAUX.md`) au **05/08/2026**.
> Périmètre : **backend uniquement** (frontend non traité).
> Dernier commit : `6bd2f0c` — 37/37 tests PHPUnit verts, swagger généré.

---

## 4. BACKEND

| Point du plan | État | Commentaire |
|---|---|---|
| **4.1 Modèles, migrations & relations** | ✅ Fait | `Commercial`, `CommercialPoint`, `Invoice`, `InvoiceItem`, `InvoicePayment`, `Setting`, `ActivityLog` + extensions `Promotion`, `User`, `Agency`, `Service` (relations, accesseurs `points_balance`, `balance_due`, `turnover`, `effective_price`, `agency_snapshot`) |
| 4.1 — Générateur de numéro de facture | ✅ Fait | `InvoiceNumberGenerator` : préfixe `PK-`, date `AAAAMMJJ`, séquence journalière sous verrou DB (advisory lock PG conditionné) |
| **4.2 Rôles & permissions** | ✅ Fait | Rôle `client` (0 permission), permissions `clients`/`commercials`/`invoices`/`activity-logs`/`settings`/`stats`, attributions par rôle (`commercial`, `caissier`, `comptable`, etc.), middleware `permission:*` sur toutes les routes |
| **4.3 Authentification & inscription client** | ✅ Fait | `POST /auth/register` public (rôle `client`, `client_number` auto CL-00001), login client normal, refus de connexion des comptes inactifs, `GET /clients` renvoie `client_number` |
| **4.4 API Clients** | ✅ Fait | CRUD complet (recherche, pagination, filtre agence), mot de passe optionnel à la création admin, suppression bloquée si factures liées (422), rôle `client` exclu de `GET /users` |
| 4.4 — Exclusion des assignations d'agence | ✅ Fait (corrigé `6bd2f0c`) | Rôle `client` ajouté à `NON_ASSIGNABLE_ROLES` dans `UserAssignmentController` |
| **4.5 API Commerciaux** | ✅ Fait | CRUD + lien optionnel user de rôle `commercial`, `available-users`, ajustement manuel de points (`adjustment` tracé), `ranking` (période from/to), `stats` par commercial (CA, ventes, points, commissions, évolution mensuelle) |
| **4.6 Points & pénalités** | ✅ Fait | `PointsService` (`awardForSale`, `applyInactivityPenalty`, `recomputeBalance`), attribution idempotente (`points_awarded` sur facture), job `PenalizeInactiveCommercials` planifié `dailyAt('01:00')` avec traçage `commercial_points` + `activity_logs` |
| **4.7 API Promotions (v2)** | ✅ Fait | `type` amount/percent, `promo_price` < prix service, `discount_percent` ∈ ]0,100], anti-chevauchement (hors promotion courante), `destroy`, promotions expirées ignorées par `oneActivePromotion`, `price_history` + `activity_logs` alimentés |
| **4.8 API Factures / Ventes** | ✅ Fait | Index (filtres agence/statut/date/client/commercial/numéro + totaux CA/impayés/avances), store multi-lignes (snapshot label/prix effectif/qty, `seller_user_id = auth`), show (lignes + paiements + solde), paiements multi-tranches (statut recalculé, points + commission si `paid`), update, cancel (`cancelled_at`, statut `cancelled`, exclu des stats, log) |
| 4.8 — Autocomplétions | ✅ Fait | `GET /commercials/search`, `GET /clients/search`, `GET /services/search` (prix effectif renvoyé) |
| 4.8 — Snapshot agence | ✅ Fait | Accesseur `agency_snapshot` (jointure, choix plan) : code, ville, téléphone, email |
| **4.9 API Stats & Dashboards** | ✅ Fait | `GET /stats/dashboard` (alias de `overview`) : nb agences/départements/users/clients/commerciaux, CA `paid`, nb factures, top 5 commerciaux ; `GET /stats/agency/{agency}` (CA, ventes, top commerciaux) ; + `monthly-revenue`, `sales-by-category`, `payment-methods`, `top-commercials` |
| 4.9 — Intégration dashboards existants | ⏸️ Frontend | `DashboardPlaceholderPage` (.tsx) — hors périmètre backend |
| **4.10 Audit / Activité** | ✅ Fait | `activity_logs` : loggers explicites dans les contrôleurs + **observers** (created/updated/deleted/restored/force_deleted) pour agences, départements, services, catégories ; `GET /activity-logs` (filtres user/entity_type/action/date, pagination) + export |
| 4.10 — Journalisation de toutes les actions | ✅ Fait | Connexions/déconnexions (`login_logs` + `activity_logs` entity_type `auth`), paiements, annulations, exports, changements de rôle (`role_changed`), assignations/chefs, réglages, permissions rôles, CRUD utilisateurs |
| 4.10 — Politique de lecture | ✅ Fait | `activity-logs.consulter` réservé super-admin & direction-générale |
| **4.11 Réglages** | ✅ Fait | `GET /settings` / `PUT /settings` (permission `settings.modifier`) : points par vente, période/pénalité d'inactivité, commission par défaut, préfixe de facture ; clé inconnue → 422 ; log d'activité |
| **4.12 Exports** | ✅ Fait | `exports/clients`, `exports/commercials`, `exports/invoices`, `exports/activity-logs` (+ `agencies`, `users`, `services` existants), permissions `*.exporter` |


## Conclusion

- **Backend Phase 3 : terminé.** Tous les points 4.1 → 4.12 sont couverts et vérifiés.
- Tests : **37/37 verts** (`vendor/bin/phpunit`), compatibles SQLite (`:memory:`) et PostgreSQL.
- Qualité : `pint` OK, swagger régénéré (`php artisan l5-swagger:generate`, fichier gitignoré).
- Migrations appliquées en production (dont `2026_08_05_000007_add_cancelled_to_invoice_status`).
- Serveur dev : `http://127.0.0.1:8000`.
