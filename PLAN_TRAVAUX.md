# Phase 3 — Clients, Commerciaux & Facturation (Ventes)

> Document de travail : tâches séparées **Backend** et **Frontend**.
> Schémas associés : `mcd.puml`, `mld.puml`, `flowchart.puml` (même dossier).
> Base : migration des entités de la Phase 1/2 (formations/modules supprimées, catalogue en place).

---

## 1. Vue d'ensemble

Trois nouvelles entités cœur :

1. **Client** — s'inscrit via une page publique `/register`, stocké dans `users` avec le rôle `client`.
   Le rôle `client` n'est **jamais affiché côté frontend** (exclu des listes d'utilisateurs, du menu rôles…) : il sert uniquement à différencier en base. CRUD complet côté admin.
2. **Commercial** — profil métier dans une nouvelle table `commercials`, **optionnellement lié** à un `user` ayant le rôle `commercial`.
   - Lié → il peut se connecter à la plateforme.
   - Non lié → il ne peut pas se connecter, mais reste enregistré et **apparaît sur les factures** pour l'attribution des ventes.
   - Système de **points** (ex. +3 pts/vente, configurable) + **pénalités** d'inactivité (ex. −N pts après 2 semaines sans vente, période configurable par super-admin / direction-générale).
   - **Commission** par vente : pourcentage du prix du service (modifiable par l'admin) **ou** montant fixe — configurable globalement et/ou par commercial (certains commerciaux n'ont pas de commission).
3. **Facture / Vente** — table dédiée `invoices` (distincte de la réservation d'un service). Enregistre une vente : logo PEKEGNO + infos de l'agence vendeuse, commercial associé (optionnel, autocomplétion intelligente), numéro incrémental `PK-AAAAMMJJ-NNN`, date, client associé, type de paiement (espèces / mobile money), lignes (service, prix unitaire, quantité), total, statut (payée / partielle / impayée), avance, commentaire. Paiement **en plusieurs tranches**.

**Compléments transverses** demandés :
- Promotions services **v2** : montant (nouveau prix, prix de base barré) **ou** pourcentage, avec date de début / date de fin.
- **Traçabilité totale** : journal d'audit (`activity_logs`) de **toutes** les actions (CRUD agences/users/départements/services/catégories/commerciaux/clients/factures, connexions, 2FA, exports…), consultable par admin / direction.
- **Stats** : chiffre d'affaires des agences dans le dashboard admin **et** le dashboard agence ; stats commerciales (CA, nb ventes, points, commissions, classement).

---

## 2. Règles métier (définitions de fait)

### 2.1 Client
- Créé par **inscription publique** (`POST /auth/register`) **ou** par un admin (page `/clients`, CRUD).
- Stocké dans `users`, `role_id = rôle "client"`.
- `client_number` généré automatiquement (ex. `CL-00001`), unique, pour un identifiant lisible.
- Un client qui s'inscrit reçoit un compte (peut se connecter). Un client créé par admin peut l'être sans mot de passe (mot de passe requis à la première connexion, cf. `is_password_change_required`).

### 2.2 Commercial
- Profil dans `commercials` : identité (prénom, nom, email, téléphone) **indépendante** du compte utilisateur (snapshot), agence de rattachement, `user_id` optionnel.
- `user_id` doit pointer vers un `users` de rôle `commercial` et non déjà lié (unique).
- **Points** :
  - +`sales_points_per_sale` par vente **payée intégralement** (défaut 3, réglable).
  - −`inactivity_penalty_points` après `inactivity_period_days` jours sans vente payée (défaut 14 jours / 5 pts), via un job planifié quotidien.
  - Historique tracé dans `commercial_points` (raison `sale` | `penalty` | `adjustment`), avec référence à la facture.
  - Solde courant = `SUM(points)` ; stocké en cache sur `commercials.points_balance` (mis à jour en transaction).
- **Commission** : `commission_type` = `none | percent | fixed`, `commission_value`. Défaut global dans `settings`, surchargeable par commercial.
  - `percent` → % du **total de la facture** ; `fixed` → montant fixe par vente.
  - Montant figé (snapshot) sur la facture au moment de la vente (`invoices.commission_amount`).
- **Classement** : par points, puis par CA, puis par nombre de ventes.

### 2.3 Promotion (v2)
- Une promotion active par service à un instant donné (chevauchenent interdit ou automatiquement géré).
- Deux types :
  - `amount` → `promo_price` = nouveau prix (affichage : prix promo + prix de base **barré** en dessous).
  - `percent` → `discount_percent` (prix effectif = `price − price × discount_percent / 100`).
- `start_date` / `end_date` obligatoires ; une promotion n'est appliquée que si `now` ∈ [start, end].
- Le prix effectif (post-promo) est le **prix unitaire figé sur la facture** au moment de la vente.
- La création/modification de promotion alimente `price_history` (traçabilité des prix).

### 2.4 Facture / Vente
- Numéro : `PK-AAAAMMJJ-NNN` (incrément journalier, verrou transactionnel).
- Champs : agence vendeuse (optionnel si vente admin/direction), client (optionnel — vente « guichet »), commercial (optionnel, autocomplétion sur nom/email), `seller_user_id` = utilisateur connecté (toujours renseigné, pour l'audit), date, type de paiement (`cash` | `mobile`), commentaire.
- Lignes : `service_id` optionnel (ligne libre possible), **label + prix unitaire + quantité** en snapshot (le service peut changer ensuite sans altérer la facture), `line_total`.
- Montants : `total_amount`, `amount_paid` (somme des paiements), statut dérivé :
  - `unpaid` si `amount_paid = 0`,
  - `partial` si `0 < amount_paid < total_amount`,
  - `paid` si `amount_paid >= total_amount`.
- **Paiements** : plusieurs tranches via `invoice_payments` (montant, méthode, date, encaissé par, `is_advance` pour l'acompte).
- **Points & commission** : attribués **quand la facture devient `paid`** (snapshot conservés sur la facture).
- Annulation : `cancelled_at` (facture annulée exclue des stats).
- **Impression** : entête logo PEKEGNO + infos agence (code, ville, téléphone, email), numéro, date, lignes, total, avance/reste à payer, commercial, client. Imprimable quand `paid` (comptabilisée comme vente).

### 2.5 Traçabilité
- `activity_logs` : enregistre **toute** action (créer/mettre à jour/supprimer/restaurer/suppression définitive/assigner/rattacher/connexion/déconnexion/paiement/annulation/export…), avec `user_id`, `entity_type`, `entity_id`, `old_values`, `new_values`, IP, user-agent, horodatage.
- `login_logs` (existant) : connexions / échecs / déconnexions / 2FA.
- Consultable par super-admin & direction-générale (page `/audit`, filtres + pagination + export).

---

## 3. Base de données (migrations — ordre proposé)

| # | Migration | Contenu |
|---|---|---|
| 1 | `add_client_fields_to_users` | `client_number` (string unique nullable), `city`, `country`, `address` (nullable) |
| 2 | `create_commercials_table` | profil commercial (cf. MLD) + FK `user_id` unique nullable, `agency_id` nullable |
| 3 | `create_commercial_points_table` | journal des points (commercial_id, points signés, reason, invoice_id nullable, created_by) |
| 4 | `create_settings_table` | réglages clé/valeur (`sales_points_per_sale`, `inactivity_period_days`, `inactivity_penalty_points`, `default_commission_type`, `default_commission_value`, `invoice_prefix`) |
| 5 | `add_discount_to_promotions` | `type` enum('amount','percent') défaut 'amount', `discount_percent` decimal(5,2) nullable, `promo_price` rendu nullable, contrainte de cohérence |
| 6 | `create_invoices_table` | entête facture (cf. MLD) |
| 7 | `create_invoice_items_table` | lignes de facture (snapshots) |
| 8 | `create_invoice_payments_table` | encaissements / acomptes |
| 9 | `create_activity_logs_table` | journal d'audit (le modèle `ActivityLog` existe déjà) |
| 10 | seed | rôle `client` + permissions `clients`, `commercials`, `invoices`, `activity-logs`, `settings`, `stats` + valeurs par défaut des réglages |

---

## 4. BACKEND

### 4.1 Modèles, migrations & relations
- [ ] Modèles : `Commercial`, `CommercialPoint`, `Invoice`, `InvoiceItem`, `InvoicePayment`, `Setting`, `ActivityLog` (existant) ; extension `Promotion`, `User`, `Agency`, `Service`.
- [ ] Relations :
  - `User` : `hasOne(Commercial)` (profil), `hasMany(Invoice, seller_user_id)`, `hasMany(InvoicePayment, received_by)`, `hasMany(CommercialPoint, created_by)`, `hasMany(ActivityLog)`.
  - `Commercial` : `belongsTo(User)`, `belongsTo(Agency)`, `hasMany(Invoice)`, `hasMany(CommercialPoint)`, accesseur `points_balance`, `commission` calculé avec défaut settings.
  - `Invoice` : `belongsTo(Agency)`, `belongsTo(User, client)`, `belongsTo(Commercial)`, `belongsTo(User, seller)`, `hasMany(Items)`, `hasMany(Payments)`, accesseurs `amount_paid`, `status`, `balance_due`.
  - `Agency` : `hasMany(Invoice)` + accesseur `turnover` (somme des factures `paid`, non annulées).
  - `Service` : relation promotion active (`oneActivePromotion`) + accesseur `effective_price`.
- [ ] Générateur de numéro de facture : classe dédiée `InvoiceNumberGenerator` (préfixe `PK-`, date `AAAAMMJJ`, séquence journalière sous verrou DB).

### 4.2 Rôles & permissions
- [ ] Ajouter le rôle `client` dans `RoleSeeder` (sans permissions d'administration).
- [ ] Nouvelles permissions : `clients` (creer/modifier/supprimer/consulter/exporter), `commercials` (idem), `invoices` (creer/modifier/consulter/imprimer/annuler/encaisser), `activity-logs` (consulter/exporter), `settings` (modifier), `stats` (consulter).
- [ ] `super-admin` & `direction-generale` → tout. `commercial` → `invoices.consulter/creer/imprimer/encaisser`, `clients.consulter`, `stats.consulter` (limité à soi-même). `caissier` → `invoices` (création + encaissement). `comptable` → `invoices.consulter/imprimer`, `invoices.encaisser`, exports.
- [ ] Côté API : middleware/policy par permission (pattern actuel).

### 4.3 Authentification & inscription client
- [ ] `POST /auth/register` (public) : crée un `users` avec rôle `client`, `client_number` auto, `is_active = true`, `is_password_change_required = false`. Pas de 2FA à l'inscription.
- [ ] Login : le rôle `client` se connecte normalement (retourne le même profil, sans exposé du rôle admin).
- [ ] Interdiction de connexion pour les `users` non actifs (déjà en place) — étendre si nécessaire.
- [ ] `GET /clients` renvoie aussi `client_number`, etc.

### 4.4 API Clients (`/clients`)
- [ ] `index` (recherche nom/email/téléphone/client_number, pagination, filtre agence), `store` (création par admin, mot de passe optionnel), `show`, `update`, `destroy` (soft delete) — contrôleur `ClientController` (pattern `UserController`).
- [ ] Empêcher de supprimer un client ayant des factures (ou archive).
- [ ] Exclure le rôle `client` des listes `GET /users` et des assignations d'agence (côté serveur).

### 4.5 API Commerciaux (`/commercials`)
- [ ] `index` (recherche, filtre agence/statut, pagination), `store` (création + **lien optionnel** vers un `user` de rôle commercial), `show` (détail + stats), `update` (dont commission et lien), `destroy` (soft delete).
- [ ] `GET /commercials/available-users` : users de rôle `commercial` **non encore liés** (pour le dropdown de liaison).
- [ ] `POST /commercials/{commercial}/points` : ajustement manuel de points (`adjustment`, autorisé super-admin/direction) — tracé dans `commercial_points`.
- [ ] `GET /commercials/ranking` : classement (points, CA, nb ventes, commissions) avec période (`from`, `to`).
- [ ] `GET /commercials/{commercial}/stats` : CA, nb ventes, points, commissions, évolution par mois.

### 4.6 Points & pénalités (backend logique)
- [ ] Service `PointsService` : `awardForSale(Invoice)` (+pts quand facture passe `paid`), `penalizeInactive()`, `recomputeBalance(Commercial)`.
- [ ] Job planifié `PenalizeInactiveCommercials` (toutes les nuits) : commerciaux sans vente payée depuis `inactivity_period_days` → −`inactivity_penalty_points`, enregistré dans `commercial_points` + `activity_logs`.
- [ ] Attribution des points **idempotente** (vérification qu'aucune entrée `sale` n'existe déjà pour la facture).

### 4.7 API Promotions (v2)
- [ ] `store`/`update` : accepter `type` (`amount`|`percent`) + validation (si `amount` → `promo_price` requis ; si `percent` → `discount_percent` ∈ ]0,100]).
- [ ] Empêcher les chevauchements de périodes actives pour un même service (vérification dans le contrôleur).
- [ ] Supprimer/expirer : `destroy` ; une promotion expirée est ignorée par `oneActivePromotion`.
- [ ] Inscrire la création/modification de prix dans `price_history` + `activity_logs`.

### 4.8 API Factures / Ventes (`/invoices`)
- [ ] `index` : filtres (agence, statut, date, client, commercial, numéro), pagination, totaux (CA, impayés, avances).
- [ ] `store` : créer facture + lignes (service → snapshot label/prix effectif/qty), numéro auto, `seller_user_id = auth`, commercial/client/agence optionnels, commentaire, `total_amount`.
- [ ] `show` : détail complet + lignes + paiements + reste à payer (prêt pour l'impression).
- [ ] `POST /invoices/{invoice}/payments` : encaissement partiel/acompte → `invoice_payments`, mise à jour `amount_paid`/statut ; si passage à `paid` → points + commission snapshot + logs.
- [ ] `PATCH /invoices/{invoice}` : commentaire, type de paiement, client/commercial (pas de modification des montants déjà payés).
- [ ] `POST /invoices/{invoice}/cancel` : annulation (`cancelled_at`), exclue des stats, log.
- [ ] Autocomplétions : `GET /commercials/search?q=` (nom/email), `GET /clients/search?q=`, `GET /services/search?q=` (prix effectif renvoyé).
- [ ] Snapshot agence sur la facture pour l'impression (code, ville, téléphone, email au moment de la vente) : soit colonnes de snapshot, soit jointure avec l'agence (choix : jointure + accesseur, en notant le risque de modification ultérieure).

### 4.9 API Stats & Dashboards
- [ ] `GET /stats/dashboard` (admin) : nb agences/départements/users/clients/commerciaux, CA global (factures `paid`), nb factures (payées/partielles/impayées), top commerciaux.
- [ ] `GET /stats/agency/{agency}` : CA de l'agence, nb ventes, top commerciaux de l'agence, produits (services) les plus vendus.
- [ ] Intégration dans les dashboards existants (`DashboardPlaceholderPage` : sections admin & responsable-agence).

### 4.10 Audit / Activité
- [ ] Table `activity_logs` (modèle déjà présent) + middleware `log.activity` OU loggers explicites (choix : enregistrement dans les contrôleurs + événements `created/updated/deleted/restored` via observers).
- [ ] `GET /activity-logs` : filtres (user, entity_type, action, date), pagination, `GET /activity-logs/export`.
- [ ] Journaliser aussi : connexions/déconnexions (login_logs + activité), paiements, annulations, exports, changements de rôle, assignations, réglages.
- [ ] Politique : lecture réservée super-admin / direction-générale.

### 4.11 Réglages
- [ ] `GET /settings` (public authentifié ou admin), `PUT /settings` (super-admin/direction) pour : points par vente, période & pénalité d'inactivité, commission par défaut, préfixe de facture.

### 4.12 Exports
- [ ] `exports/clients`, `exports/commercials`, `exports/invoices` (CSV/Excel, pattern `ExportController` existant), `exports/activity-logs`.

---

## 5. FRONTEND

### 5.1 Inscription client (publique)
- [ ] Page `/register` (sous `GuestRoute`) : prénom, nom, email, téléphone, mot de passe + confirmation. Validation + messages d'erreur (pattern `LoginPage`).
- [ ] Redirection vers `/login` après inscription ; lien « Déjà inscrit ? Se connecter ».
- [ ] Le rôle `client` est **invisible** partout : filtré dans `GET /users`, `roles.*` traductions non utilisées, aucun affichage dans `UserMenu`.

### 5.2 Module Clients
- [ ] Route `/clients` (sous `AppLayout`) + page liste : recherche (nom/email/téléphone/client_number), pagination, badges, actions (voir/modifier/supprimer).
- [ ] Page/modale de création & édition (`ClientForm`) : identité + coordonnées + `client_number` généré (en lecture).
- [ ] Suppression avec confirmation (`ConfirmDialog`) ; blocage si factures liées (message).
- [ ] Fichiers : `api/clients.api.ts`, `pages/clients/ClientListPage.tsx`, `pages/clients/ClientFormPage.tsx` (pattern `users`).

### 5.3 Module Commerciaux
- [ ] Route `/commercials` : liste (recherche, filtre agence, filtre statut, badges points/commission, actions).
- [ ] `CommercialForm` : identité, agence, **lien utilisateur** (dropdown `available-users`, option « Aucun » = pas de connexion), commission (type + valeur, ou « aucune »), statut actif.
- [ ] Page détail `/commercials/:id` : infos, solde de points, historique des points, stats (CA, nb ventes, commissions), classement, liens vers les factures.
- [ ] Ajustement manuel de points (super-admin/direction) avec motif.
- [ ] Fichiers : `api/commercials.api.ts`, `pages/commercials/CommercialListPage.tsx`, `pages/commercials/CommercialDetailPage.tsx`, `components/commercials/CommercialForm.tsx`.

### 5.4 Module Factures / Ventes
- [ ] Route `/invoices` : liste (filtres agence/statut/période/client/commercial, pagination, totaux en entête).
- [ ] Création `/invoices/new` :
  - Entête : agence (dropdown), client (autocomplétion `clients/search`), commercial (autocomplétion `commercials/search`, **non requis**), type de paiement, date, commentaire.
  - Lignes : autocomplétion service (`services/search` → prix effectif affiché), quantité, prix unitaire éditable, suppression de ligne ; total recalculé.
  - Statut initial `unpaid` (ou avance saisie à la création).
- [ ] Détail `/invoices/:id` : entête imprimable (logo PEKEGNO + infos agence), lignes, totaux, avance, reste à payer, historique des paiements.
  - Modal « Encaisser » : montant, méthode, `is_advance`, encaissé par ; mise à jour du statut en direct.
  - Boutons : Imprimer (fenêtre d'impression `@media print`), Annuler (confirmation).
- [ ] Indicateur visuel de statut (payée / partielle / impayée) + rappel « reste à payer ».
- [ ] Fichiers : `api/invoices.api.ts`, `pages/invoices/InvoiceListPage.tsx`, `pages/invoices/InvoiceFormPage.tsx`, `pages/invoices/InvoiceDetailPage.tsx`, `components/invoices/InvoicePrint.tsx`.

### 5.5 Promotions (v2)
- [ ] Dans le détail d'un service (admin) : formulaire promo avec bascule **Montant / Pourcentage** + dates de début/fin + validation anti-chevauchenent (message).
- [ ] Affichage service : si promo active → prix promo (gras, couleur brand) + prix de base **barré** en dessous + badge « Promo −X% » / « Promo » + dates.
- [ ] Mise à jour de `promotions.api.ts` (`type`, `discount_percent`).

### 5.6 Dashboards & stats
- [ ] Dashboard admin : cartes CA global, nb clients, nb commerciaux, nb factures + répartition payées/partielles/impayées + **CA par agence** + top commerciaux.
- [ ] Dashboard responsable-agence : **CA de l'agence**, nb ventes, top commerciaux de l'agence.
- [ ] Consommation des endpoints `/stats/*`.

### 5.7 Page Audit (activité)
- [ ] Route `/audit` (super-admin/direction) : tableau des `activity_logs` (action, entité, description, utilisateur, IP, date), filtres (entité, action, utilisateur, période), pagination, export.

### 5.8 Page Réglages (commerciaux & facturation)
- [ ] Route `/settings` (super-admin/direction) : points par vente, période & pénalité d'inactivité, commission par défaut (type + valeur), préfixe de facture.

### 5.9 Navigation, permissions UI & i18n
- [ ] Sidebar (par rôle) : ajouter « Clients », « Commerciaux », « Factures » (admin/direction), « Audit » (admin/direction), « Réglages » (admin/direction) ; adapter `navItems.ts`.
- [ ] Router : nouvelles routes lazy (`router/index.tsx`), protection par rôle.
- [ ] i18n : clés `fr`/`en` pour tous les nouveaux libellés (maintenir la parité 581 → 581+n).
- [ ] Comportement mobile (tiroir contextuel) appliqué aux nouvelles pages (`AppLayout`).

---

## 6. Ordre de réalisation suggéré

1. **BD** : migrations (clients→commerciaux→points→settings→promos v2→factures→log) + seed rôles/permissions.
2. **Backend cœur** : modèles/relations, `ClientController`, `CommercialController`, `InvoiceController` (+ générateur de numéro, paiements, statuts), `PromotionController` v2.
3. **Backend transversal** : `PointsService` + job pénalités, `ActivityLog`, `StatsController`, `SettingController`, exports.
4. **Frontend fondations** : `/register`, module Clients.
5. **Frontend Commerciaux** (liste/form/détail/points).
6. **Frontend Factures** (liste/création/détail/encaissement/impression).
7. **Frontend** Promotions v2, dashboards, `/audit`, `/settings`, navigation + i18n.
8. **Validation** : `tsc -b`, `vite build`, parité i18n, tests des règles (statuts, numérotation, points, pénalités).

---

## 7. Fichiers impactés (récap indicatif)

- **Backend** : `database/migrations/*` (10 nouvelles), `database/seeders/{RoleSeeder,DatabaseSeeder,PermissionSeeder}`, `app/Models/{Commercial,CommercialPoint,Invoice,InvoiceItem,InvoicePayment,Setting}.php`, `app/Models/{User,Promotion,Agency,Service}.php`, `app/Http/Controllers/Api/{ClientController,CommercialController,InvoiceController,StatsController,ActivityLogController,SettingController,RegisterController}.php`, `app/Http/Controllers/Api/{PromotionController,ExportController,UserController}.php`, `app/Services/{PointsService,InvoiceNumberGenerator}.php`, `app/Jobs/PenalizeInactiveCommercials.php`, `routes/api.php`, `config/` (défauts), tests.
- **Frontend** : `src/api/{clients,commercials,invoices,stats,settings}.api.ts`, `src/api/{promotions,users}.api.ts`, `src/pages/register/RegisterPage.tsx`, `src/pages/{clients,commercials,invoices}/`, `src/pages/SettingsPage.tsx`, `src/pages/AuditPage.tsx`, `src/pages/DashboardPlaceholderPage.tsx`, `src/pages/agencies/AgencyOverviewPage.tsx`, `src/router/index.tsx`, `src/components/layout/navItems.ts`, `src/i18n/locales/{fr,en}.ts`, `src/components/services/*` (promo).
