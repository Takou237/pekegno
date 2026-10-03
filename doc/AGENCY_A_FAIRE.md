# À faire — Département **Pekegno Agency** (type `agency`)

Document de travail partagé (2 développeurs). Sources combinées :

1. **Cahier des charges fonctionnel** (`PEKEGNO_Management_System_Cahier_des_Charges_Fonctionnel (1).docx`) — §8 Pekegno Agency, §11 Moteur de ventes, §13 Bilan, §15 Commissions, §17 Automatisations, §18 Rapports, §29 Parcours critiques.
2. **Réunion** — précisions métier sur packages, prestations, actions, équipe client, contrats, notation, commissions, comptabilité/bilan, menu.
3. **État réel du dépôt** au 2026-10-03 (backend Laravel `backend/`, frontend React/Vite `frontend/`).

> Légende : 🟢 existe déjà / réutilisable · 🟡 existe partiellement, à étendre · 🔴 à créer

---

## 0. Résumé en une page

| # | Sujet | Ce qu'il faut retenir |
|---|---|---|
| 1 | **Packages** | Packs de services **catégorisés** (ex. Starter / Booster / Croissance / Entreprise). Champs : nom, accroche, catégorie, liste des services inclus, **prérequis**, **recommandations** (ex. « 01 community manager, 02 commerciaux »), **prix barré + prix**, **promotions**, période de souscription. |
| 2 | **Souscription** | Un client souscrit à un package **sur une période définie**. Un client peut souscrire à **plusieurs packages**. **Chaque package choisi crée un nouveau contrat.** |
| 3 | **Prestations** | Catégorie, nom, période (début/fin), client, **budget de la prestation**, **commercial qui a vendu**. |
| 4 | **Actions** | Créées **dans** une prestation. Ex. « poster 3 vidéos Facebook par semaine ». Chaque action a un **statut suivi**, un **budget** et des **commentaires**. Chaque action **prélève** sur le budget global de la prestation. |
| 5 | **Validation prestation → contrat** | La validation d'une prestation **crée un contrat** liant Pekegno, le client et la prestation, avec le **budget alloué**. |
| 6 | **Équipe client** | Ensemble des users/employés affectés sur les différentes prestations, avec des **rôles propres à l'Agency** (≠ rôles applicatifs admin/caissier…). |
| 7 | **Contrat** | Plusieurs statuts (cycle de vie complet, voir §4.6). |
| 8 | **Notation** | Notation **sur 5 étoiles** façon Play Store (moyenne, nombre d'avis, répartition 5★→1★). **Seul le client note** (portail client, D5), **une note par action, modifiable** (D11) ; la note de la prestation = moyenne de ses actions. |
| 9 | **Commissions** | Établies sur les prestations (et packages) **comme pour les produits/services**, via le moteur de règles existant. |
| 10 | **Comptabilité & bilan du jour** | Pages Comptabilité et Bilan journalier propres au département (comme Academy). |
| 11 | **Menu** | Garder **Renouvellements, Factures, Créances, Rapports**. **Retirer « Academy »** du menu latéral Agency. |
| 12 | **Grand tableau de suivi** | Colonnes : **Prestations · Notes · Statut · Motif (optionnel)**. |

---

## 1. Menu latéral cible du département Agency

Fichier : `frontend/src/components/layout/navItems.ts` → `getDepartmentItems()` → `case 'agency'`.

| Ordre | Item | Route (`/departments/:departmentId/…`) | État actuel | Action |
|---|---|---|---|---|
| 1 | Dashboard | `''` | 🟡 `DepartmentOverviewPage` générique | Ajouter KPI Agency (§6.1) |
| 2 | Prospects | `prospects` | 🟡 pointe vers `AcademyProspectsPage` | Vérifier filtre `interest = agency` / département |
| 3 | Clients | `clients` | 🟢 `ClientListPage` / `ClientDetailPage` | Ajouter onglets Packages / Prestations / Contrats sur la fiche |
| 4 | Packages | `packages` | 🔴 `ComingSoonPage` | Créer (§6.2) |
| 5 | Souscriptions | `subscriptions` | 🟡 `AgencySubscriptionsPage` existe hors département | Brancher / adapter (§6.3) |
| 6 | Prestations | `prestations` | 🔴 (aujourd'hui `services` = catalogue) | Créer (§6.4) |
| 7 | Suivi des prestations (grand tableau) | `prestations/tracking` | 🔴 | Créer (§6.6) |
| 8 | Équipe client | `client-team` | 🔴 | Créer (§6.7) |
| 9 | Contrats | `contracts` | 🟡 `ContractListPage` / `ContractDetailPage` | Étendre (§6.8) |
| 10 | Services (catalogue) | `services` | 🟢 `DepartmentServicesPage` | Garder (sert à composer les packages) |
| 11 | Community Management | `community` | 🔴 `ComingSoonPage` | Vue filtrée des actions de type CM (§6.5) |
| 12 | Publicité | `advertising` | 🔴 `ComingSoonPage` | Vue filtrée des actions de type pub + budget pub (§6.5) |
| 13 | **Renouvellements** | `renewals` | 🟢 `RenewalsPage` | Garder, étendre aux contrats de packages |
| 14 | **Factures** | `invoices` | ⚠️ **Bug** : l'item pointe sur `payments` qui affiche `SellerProfilesPage` (route Academy) | Créer `AgencyInvoicesPage` + corriger la route (§6.9) |
| 15 | **Créances** | `receivables` | 🟡 `AcademyReceivablesPage` | Réutiliser avec filtre département Agency |
| 16 | Commissions | `commissions` | 🟡 `AcademyCommissionsPage` | Réutiliser / généraliser |
| 17 | Comptabilité | `accounting` | 🟡 `AcademyAccountingPage` (wrapper de `AccountingPage`) | Même wrapper pour Agency |
| 18 | Bilan du jour | `bilans` | 🟡 `AcademyBilanPage` (wrapper de `DailyBilanPage`) | Même wrapper + bloc Agency |
| 19 | **Rapports** | `reports` | 🟡 pointe vers `AcademyReportsPage` | Créer `AgencyReportsPage` (§6.11) |
| 20 | Paramètres | `settings` | 🟢 `DepartmentSettingsPage` | Ajouter catégories, rôles équipe, délais d'alerte |
| — | ~~Academy~~ | ~~`academy`~~ | 🟢 `AgencyAcademyPage` | **RETIRER du menu Agency** |

> ⚠️ **Conflits de routes à régler** dans `frontend/src/router/index.tsx` (bloc `/departments/:departmentId`) : les routes sont partagées entre types de département (`prospects`, `reports`, `payments`, `receivables`, `planning` est même déclaré 2 fois). Pour Agency, il faut soit des chemins dédiés, soit un composant « switch » qui choisit la page selon `department.type` (recommandé : petit composant `ByDepartmentType` qui lit le type depuis le contexte du `DepartmentLayout`).

---

## 2. Existant réutilisable (à ne pas recoder)

| Élément | Fichier(s) | Utilisation pour Agency |
|---|---|---|
| `Department::TYPE_AGENCY` | `app/Models/Department.php` | Filtrage par type |
| `SubscriptionPack` + `SubscriptionPackService` | `app/Models/SubscriptionPack.php`, `SubscriptionPackService.php` | **Base des packages** (à étendre) |
| `Subscription` (+ cycle de vie, expiry) | `app/Models/Subscription.php`, `CheckSubscriptionExpiryCommand` | **Lecture seule / historique**, migration vers `contracts` (décision D1) |
| `Contract` + `ContractService` (lignes) | `app/Models/Contract.php`, `app/Services/ContractService.php` | Contrat central ; a déjà `pack_id`, `department_id`, statuts, renouvellement, `markDueSoon()`, `markExpired()` |
| `Promotion` | `app/Models/Promotion.php` | Ajouter `package_id` (déjà fait pour `formation_id`) |
| `Category` | `app/Models/Category.php` | Catégories partagées services/produits (voir D2) |
| `CommissionRule` / `CommissionEntry` / `CommissionService` | `app/Models/…`, `app/Services/CommissionService.php` | Ajouter le périmètre package / prestation |
| `Invoice` / `InvoiceItem` / `InvoicePayment` / `PaymentService` | `app/Models/…`, `app/Services/PaymentService.php` | Facturation des contrats |
| `AccountingCategory.is_pass_through` | `app/Models/AccountingCategory.php` | **Séparer budget pub client vs honoraires Pekegno** (cahier §8.2) |
| `BilanService` / `BilanController` | `app/Services/BilanService.php` | Bilan du jour (ajouter bloc Agency) |
| `AccountingPage`, `DailyBilanPage` | `frontend/src/pages/accounting`, `frontend/src/pages/bilans` | Wrappers `fixedAgencyId` comme Academy |
| `RenewalsPage`, `ContractListPage`, `ContractDetailPage` | `frontend/src/pages/agency/` | Base des écrans Agency |
| `ScopeService` | `app/Services/ScopeService.php` | Restriction par périmètre (pays/agence) |
| `ActivityLogger` | `app/Services/ActivityLogger.php` | Audit des actions sensibles |
| `PendingInvoiceNotifier` | `app/Services/PendingInvoiceNotifier.php` | Factures de contrats en attente de validation |
| Permissions `contrats.*`, `abonnements.*` | `database/seeders/PermissionSeeder.php` | Ajouter `packages.*`, `prestations.*`, `equipe-client.*` |

---

## 3. Décisions d'architecture et métier — ✅ VALIDÉES (2026-10-03)

| # | Question | ✅ Décision retenue | Conséquences pour le dev |
|---|---|---|---|
| **D1** | Garder la table `subscriptions` à côté de `contracts` ? | **Le contrat est l'objet central.** Souscrire à un package = créer un `Contract` (`pack_id` + période). `subscriptions` passe en **lecture seule** (historique), puis on migre ses données vers `contracts`. | Plus aucune écriture dans `subscriptions` côté Agency. Les échéances/renouvellements ne se calculent que sur `contracts`. Prévoir une migration de reprise `subscriptions → contracts` (à valider avant exécution). |
| **D2** | Catégories de packages / prestations : réutiliser `categories` ou nouvelle table ? | **Nouvelle table `agency_categories`** avec `kind` (`package` \| `prestation`) et `department_id`. | Le catalogue `categories` (services/produits) n'est pas modifié. |
| **D3** | Package vs prestation : quelle relation ? | **La souscription à un package crée automatiquement une prestation**, pré-remplie avec les items du package comme actions. | `PackageService::subscribe()` ⇒ contrat **+ prestation** (`package_id` renseigné) + facture. Un seul circuit de suivi / notation / équipe. |
| **D4** | Budget des actions : plafond strict ? | **Blocage strict** : refus si `Σ budget actions > budget prestation`. « Budget restant » affiché. | Validation backend (422) ; pas de permission de dépassement. Pour dépasser, il faut augmenter le budget de la prestation. |
| **D5** | Qui note la prestation (5★) ? | **Le client uniquement**, depuis le portail client (`frontend_client/`). | Pas de saisie interne de note. Le staff voit les notes **en lecture seule**. Pas de champ `source`. Endpoint de notation dans `/api/client/*`, réservé au client de la prestation. |
| **D6** | Déclenchement des commissions prestation / package | **Au paiement** (`on_payment`), comme les produits. | Commission calculée sur chaque `InvoicePayment` d'une facture de contrat. |
| **D7** | Budget pub : CA ou pass-through ? | **Pass-through** : budget pub client `is_pass_through`, exclu du CA ; seuls les honoraires comptent dans le CA. | `BilanService` / rapports excluent le pass-through du CA. Reste à confirmer avec la finance (cahier §8.2). |
| **D8** | Délais d'alerte de renouvellement | **Configurables**, par défaut **J-30 / J-15 / J-7 / J-1**. | Via `ContractService::getRenewAlertDays()` + réglage dans les paramètres du département. |
| **D9** | Qui valide une prestation (⇒ création du contrat) ? | **Chef d'agence** (sur son périmètre) **+ direction générale** (partout). | Permission `prestations.valider` attribuée à ces 2 rôles uniquement ; contrôle de périmètre via `ScopeService`. La finance ne valide pas. |
| **D10** | Quand un contrat passe-t-il `active` ? | **Au premier paiement validé.** Le PDF signé est facultatif. | Hook dans `PaymentService` : 1er `InvoicePayment` validé d'une facture liée ⇒ contrat `pending → active` (+ prestation `validated → in_progress`). Champ `signed_document_path` optionnel. |
| **D11** | Granularité / fréquence de notation | **Une note par action**, **modifiable** par le client quand il veut. | Table `prestation_action_reviews`, unique (`prestation_action_id`, `client_user_id`). La note de la **prestation** = moyenne des notes de ses actions ; répartition 5★→1★ par prestation (1 avis = 1 action notée). L'historique des modifications est conservé (activity log). |
| **D12** | Statut requis pour noter | Prestation **`in_progress` ou `completed`.** | 422 si la prestation est dans un autre statut. Une action `cancelled` ne peut pas être notée. |
| **D13** | Taux de commission | **Par package.** | `commission_rules.package_id` uniquement (pas de règle par catégorie de prestation). |
| **D17** | Commission d'une prestation **hors package** (créée à la main) | **Taux saisi sur la prestation.** | Champs `commission_type` (`percent` \| `fixed`) + `commission_value` sur `prestations`. `CommissionService` : package ⇒ règle du package ; sinon ⇒ taux de la prestation. Toujours déclenché au paiement (D6), avec snapshot dans `commission_entries.rule_snapshot`. |
| **D14** | Destinataires des alertes de renouvellement | **Chef d'agence + client.** | Notification interne + tâche de relance au chef d'agence ; rappel au client. Le commercial n'est **pas** destinataire. |
| **D18** | Canal du rappel client | **E-mail + notification dans le portail client.** | Mail via l'envoi existant + notification in-app dans `frontend_client/`. Pas de SMS/WhatsApp en V1. |
| **D15** | Le budget pub transite-t-il par Pekegno ? | **Oui.** Le client paie Pekegno, qui paie les plateformes. | Encaissement suivi en trésorerie comme **pass-through** (hors CA, D7) ; décaissement vers les plateformes = dépense pass-through liée à l'action pub. |
| **D16** | Reprise `subscriptions → contracts` | **Tout l'historique** (actifs, expirés, annulés…). | Migration de reprise avec mapping des statuts (`renewed`→`renewed`, `cancelled`→`terminated`, etc.) + journal d'import ; à exécuter seulement après validation (pas sur la base locale sans accord). |

---

## 4. Modèle de données (migrations + modèles)

> Rappel mémoire projet : **ne pas lancer `migrate`/`seed` sur la base locale sans l'accord de l'autre dev / de Mike.**

### 4.1 `agency_categories` 🔴

| Champ | Type | Note |
|---|---|---|
| id | uuid | |
| department_id | uuid FK departments | périmètre |
| kind | enum `package`, `prestation` | |
| name | string | ex. « Packages stratégiques mensuels », « Community management », « Publicité », « Shooting » |
| description, color, icon | nullable | |
| is_active | bool | |
| timestamps, softDeletes | | |

### 4.2 Packages — étendre `subscription_packs` 🟡

Champs existants : `agency_id`, `name`, `description`, `price_per_month`, `is_active`.

Ajouter :

| Champ | Type | Exemple (flyer) |
|---|---|---|
| code | string unique | `PKG-0001` |
| department_id | uuid FK | |
| category_id | uuid FK `agency_categories` | « Packages stratégiques mensuels » |
| tagline | string nullable | « Lancez votre machine digitale » |
| prerequisites | text nullable | prérequis côté client (page FB active, logo, etc.) |
| original_price | decimal nullable | **prix barré** : 370 000 |
| price_per_month | (existant) | **prix** : 299 000 |
| billing_period | enum `monthly`, `quarterly`, `yearly`, `one_shot` | « mensuel » |
| min_duration_months | int nullable | durée minimale d'engagement |
| sort_order | int | ordre d'affichage (Starter → Entreprise) |
| is_public | bool | visible sur le site client plus tard |
| cover_image | string nullable | |

#### 4.2.1 `package_items` 🔴 (contenu du pack — les puces du flyer)

| Champ | Type | Exemple |
|---|---|---|
| id, package_id | uuid | |
| service_id | uuid FK services nullable | lien vers le service catalogue si existant |
| label | string | « Campagne Facebook & Instagram » |
| quantity | int nullable | 1 |
| frequency | enum `per_day`, `per_week`, `per_month`, `once` nullable | `per_month` |
| unit | string nullable | campagne, vidéo, post, heure de coaching… |
| sort_order | int | |

> Remplace/complète `subscription_pack_services` (qui ne lie qu'un `service_id` + prix). Garder `subscription_pack_services` si on veut la ventilation de prix par service.

#### 4.2.2 `package_recommendations` 🔴 (bloc « NOS RECOMMANDATIONS »)

| Champ | Type | Exemple |
|---|---|---|
| id, package_id | uuid | |
| client_team_role_id | uuid FK nullable | « Community manager » |
| label | string | si rôle libre |
| quantity | int | 1 / 2 / 3 / 4 |

#### 4.2.3 Promotions 🟡

Ajouter `package_id` (nullable) à `promotions` (comme `formation_id`). Méthode `SubscriptionPack::activePromotion()` + accesseur `effective_price` (même logique que `Service::getEffectivePriceAttribute`).

### 4.3 Prestations — `prestations` 🔴

| Champ | Type | Note |
|---|---|---|
| id | uuid | |
| reference | string unique | `PRS-2026-0001` (référence lisible, cahier §20) |
| agency_id, department_id | uuid FK | contexte |
| category_id | uuid FK `agency_categories` (kind=prestation) | |
| name | string | |
| description | text nullable | |
| client_id | uuid FK users/clients | |
| company_id | uuid FK nullable | si client entreprise |
| commercial_id | uuid FK commercials | **commercial qui a vendu** |
| commission_type | enum `percent`, `fixed` nullable | **seulement si hors package** (D17) |
| commission_value | decimal nullable | % ou montant fixe (D17) |
| package_id | uuid FK nullable | si issue d'un package (D3) |
| contract_id | uuid FK nullable | rempli à la validation |
| start_date, end_date | date | **période** |
| budget | decimal | **budget global** |
| budget_allocated | decimal (calculé, ou accesseur) | Σ budgets des actions |
| budget_spent | decimal (calculé) | Σ coûts réels des actions réalisées |
| budget_remaining | accesseur | `budget - budget_allocated` |
| status | enum (voir 4.3.1) | |
| status_reason | text nullable | **motif** (suspension, annulation, rejet…) — colonne « Motif » du grand tableau |
| rating_avg | decimal(2,1) nullable (cache) | moyenne des notes **de ses actions** (D11) |
| rating_count | int (cache) | nb d'actions notées |
| validated_by, validated_at | | chef d'agence ou direction générale (D9) |
| created_by | | audit |
| timestamps, softDeletes | | |

#### 4.3.1 Statuts prestation

`draft` (brouillon) → `pending_validation` (soumise) → `validated` (⇒ crée le contrat) → `in_progress` → `completed`
Transitions latérales : `suspended` (motif obligatoire), `cancelled` (motif obligatoire), `rejected` (motif obligatoire, depuis `pending_validation`).

Implémenter comme `CommissionEntry::transitionTo()` (table de transitions autorisées + log d'activité).

### 4.4 Actions — `prestation_actions` 🔴

| Champ | Type | Exemple |
|---|---|---|
| id, prestation_id | uuid | |
| type | enum `community_management`, `advertising`, `content_production`, `coaching`, `strategy`, `other` | alimente les menus CM / Publicité |
| title | string | « Poster des vidéos Facebook » |
| platform | string nullable | Facebook, Instagram, TikTok… |
| quantity | int | 3 |
| frequency | enum `per_day`, `per_week`, `per_month`, `once` | `per_week` |
| unit | string | vidéo |
| budget | decimal | **prélevé** sur le budget de la prestation |
| actual_cost | decimal nullable | coût réel (budget pub réellement dépensé, etc.) |
| is_pass_through | bool | budget pub du client (D7) |
| assigned_to | uuid FK users nullable | membre de l'équipe client |
| start_date, due_date | date nullable | |
| status | enum `todo`, `in_progress`, `done`, `validated`, `cancelled`, `blocked` | **suivi de statut** |
| comment | text nullable | dernier commentaire / note rapide |
| rating | tinyint nullable (cache) | note du client sur l'action (D11) |
| sort_order | int | |
| timestamps, softDeletes | | |

**Règle métier** : à la création/modification, `Σ actions.budget (hors cancelled) ≤ prestation.budget`, sinon 422 avec message « Budget restant insuffisant : X FCFA ».

#### 4.4.1 `prestation_action_comments` 🔴 (historique des commentaires)

`id`, `prestation_action_id`, `user_id`, `body`, `attachment_path` nullable, timestamps.

#### 4.4.2 `prestation_action_logs` 🔴 (exécution / preuves — optionnel V1, recommandé)

Permet de suivre « 3 vidéos par semaine » : chaque réalisation est une ligne.
`id`, `prestation_action_id`, `done_at`, `quantity_done`, `proof_url` (lien du post), `cost` nullable, `user_id`, `note`.
→ Calcul de la progression : `quantity_done` sur la période / `quantity × nb périodes`.

### 4.5 Équipe client 🔴

#### `client_team_roles` (rôles métier Agency, ≠ rôles applicatifs)

`id`, `department_id`, `name` (Community manager, Account manager, Graphiste, Vidéaste, Media buyer, Commercial, Coach…), `description`, `color`, `is_active`, timestamps.

> Ces rôles ne donnent **aucune permission applicative**. Les permissions restent gérées par `roles`/`permissions` existants.

#### `prestation_team_members`

| Champ | Type |
|---|---|
| id | uuid |
| prestation_id | uuid FK |
| user_id | uuid FK users (employé) |
| client_team_role_id | uuid FK |
| is_lead | bool (responsable de la prestation) |
| start_date, end_date | date nullable |
| timestamps | |

Contrainte unique : (`prestation_id`, `user_id`, `client_team_role_id`).

### 4.6 Contrats — étendre `contracts` 🟡

Ajouter :

| Champ | Type | Note |
|---|---|---|
| prestation_id | uuid FK nullable | contrat issu d'une prestation validée |
| pack_id | (existant) | contrat issu d'une souscription à un package |
| origin | enum `prestation`, `package`, `manual` | |
| budget_allocated | decimal nullable | budget de la prestation figé à la validation |
| commercial_id | uuid FK nullable | pour commissions / rapports |
| signed_at | datetime nullable | |
| document_path | string nullable | PDF du contrat généré |
| suspended_reason | text nullable | |

Statuts : existants `active`, `due_soon` (« à renouveler »), `expired`, `suspended`, `terminated` (« résilié ») — cahier §8.1.
Ajouter en amont : `draft` (brouillon) et `pending` (en attente du **premier paiement**, D10).
Ajouter : `renewed` (remplacé par un contrat enfant via `parent_contract_id`).

Règles :
- **Validation prestation ⇒ `Contract::create(origin=prestation, prestation_id, client_id, agency_id, department_id, amount=budget, budget_allocated=budget, start/end = période prestation, status=pending)`.**
- **Activation (D10)** : `pending → active` automatiquement au premier paiement validé d'une facture du contrat. Le PDF signé (`signed_document_path`) peut être déposé mais n'est pas bloquant.
- **Souscription package ⇒ un nouveau contrat par package** (`origin=package`, `pack_id`, `amount = prix effectif × durée`, `billing_cycle = package.billing_period`). Un client avec 3 packages = 3 contrats.
- Un contrat lié à Pekegno (agence), au client et à la prestation : afficher les 3 parties sur le PDF.

### 4.7 Notation — `prestation_action_reviews` 🔴 (D5 : client uniquement · D11 : une note par action, modifiable)

| Champ | Type |
|---|---|
| id | uuid |
| prestation_action_id | uuid FK |
| prestation_id | uuid FK (dénormalisé pour les agrégats) |
| client_user_id | uuid FK users (le client de la prestation) |
| rating | tinyint 1..5 (check constraint) |
| comment | text nullable |
| timestamps |

**Unique (`prestation_action_id`, `client_user_id`)** : une seule note par action ; le client la **modifie** quand il veut (upsert). Chaque modification est tracée via `ActivityLogger` (ancienne → nouvelle note).
Règles : seul le client lié à la prestation (`prestations.client_id`) peut noter ; prestation `in_progress` ou `completed` (D12) ; action non `cancelled`. Le staff n'a **aucune écriture**, uniquement la lecture.
Après upsert/delete → recalculer `prestation_actions.rating` et `prestations.rating_avg` / `rating_count`.
Résumé par prestation (affichage Play Store, 1 avis = 1 action notée) : `{ avg: 4.3, count: 6, distribution: {5: 3, 4: 2, 3: 1, 2: 0, 1: 0} }`.
Agrégats aussi disponibles par package, catégorie, commercial, membre d'équipe (actions assignées), agence : `GET /api/prestations/reviews/summary?package_id=&category_id=&commercial_id=&user_id=&department_id=`.

### 4.8 Facturation & commissions 🟡

- `invoices` : ajouter `contract_id` (nullable FK) — une facture par échéance de contrat.
- `invoice_items` : ajouter `package_id` et `prestation_id` (nullables), comme `service_id` / `product_id`.
- `commission_rules` : ajouter `package_id` (nullable) — **taux par package (D13)** → mêmes formules (`percent`, `fixed`, `tiered`) que les produits, déclenchement au paiement (D6).
- `commission_entries.product_type` : accepter `package` et `prestation`.

### 4.9 Seeders 🔴

- Permissions (`PermissionSeeder.php`) :
  - `packages` : consulter, creer, modifier, supprimer
  - `prestations` : consulter, creer, modifier, supprimer, valider, exporter (pas de `noter` : la note est réservée au client, D5)
  - `prestation-actions` : consulter, creer, modifier, supprimer
  - `equipe-client` : consulter, gerer
- Attribution (`RoleSeeder.php`) : direction-generale (tout), chef d'agence (tout sur son périmètre, dont `prestations.valider`, D9), commercial (créer prestations/souscriptions, voir les siennes), community-manager (voir prestations affectées, modifier statut des actions, commenter).
- Données par défaut (seed **à valider avant exécution**) : catégorie « Packages stratégiques mensuels » + les 4 packages du flyer (§9), rôles équipe client par défaut.

---

## 5. Backend Laravel — tâches

### 5.1 Modèles 🔴/🟡
`AgencyCategory`, `PackageItem`, `PackageRecommendation`, `Prestation`, `PrestationAction`, `PrestationActionComment`, `PrestationActionLog`, `ClientTeamRole`, `PrestationTeamMember`, `PrestationActionReview`. Étendre `SubscriptionPack`, `Contract`, `Promotion`, `Invoice`, `InvoiceItem`, `CommissionRule`.

### 5.2 Services métier 🔴

| Service | Méthodes clés |
|---|---|
| `PackageService` | `effectivePrice()`, `subscribe(client, package, start, months, commercial)` ⇒ crée **contrat + prestation pré-remplie (actions = items du package, D3)** + facture |
| `PrestationService` | `create()`, `submit()`, `validate()` ⇒ crée **contrat**, `suspend(reason)`, `cancel(reason)`, `complete()`, `recalculateBudget()` |
| `PrestationActionService` | `create/update` avec contrôle de budget, `changeStatus()`, `logExecution()`, `progress()` |
| `PrestationReviewService` | `rateAction()` (upsert, **client uniquement**, une note par action, D5/D11), `summary()` (moyenne + distribution par prestation et agrégés) |
| `ContractService` (existant) | ajouter `createFromPrestation()`, `createFromPackage()`, `activateOnFirstPayment()` (D10, appelé depuis `PaymentService`), `generatePdf()`, gérer `draft`/`pending`/`renewed` |
| `SubscriptionMigrationService` / commande `agency:migrate-subscriptions` | reprise **de tout l'historique** `subscriptions → contracts` (D16), idempotente, avec journal d'anomalies |
| `CommissionService` (existant) | prestation issue d'un package ⇒ règle `package_id` (D13) ; prestation hors package ⇒ `commission_type`/`commission_value` de la prestation (D17) ; déclenchement **au paiement** (D6) |
| `BilanService` (existant) | ajouter `packages_by_category` et `prestations_by_category` + **exclusion du pass-through du CA** (D7) |

Toutes les mutations sensibles → `ActivityLogger` (validation, changement de statut, budget, note, résiliation).

### 5.3 Contrôleurs + routes 🔴

```
# Catégories Agency
GET|POST        /api/agency-categories?kind=&department_id=
PUT|DELETE      /api/agency-categories/{category}

# Packages
GET|POST        /api/packages?department_id=&category_id=&active=
GET|PUT|DELETE  /api/packages/{package}
POST            /api/packages/{package}/subscribe          # => contrat (+ prestation, + facture)

# Prestations
GET|POST        /api/prestations?department_id=&status=&client_id=&commercial_id=&category_id=&from=&to=
GET|PUT|DELETE  /api/prestations/{prestation}
POST            /api/prestations/{prestation}/submit
POST            /api/prestations/{prestation}/validate     # => contrat
POST            /api/prestations/{prestation}/reject       # motif requis
POST            /api/prestations/{prestation}/suspend      # motif requis
POST            /api/prestations/{prestation}/cancel       # motif requis
POST            /api/prestations/{prestation}/complete
GET             /api/prestations/tracking                  # grand tableau (§6.6)

# Actions
GET|POST        /api/prestations/{prestation}/actions
PUT|DELETE      /api/prestation-actions/{action}
POST            /api/prestation-actions/{action}/status
GET|POST        /api/prestation-actions/{action}/comments
GET|POST        /api/prestation-actions/{action}/logs

# Équipe client
GET|POST        /api/client-team-roles?department_id=
PUT|DELETE      /api/client-team-roles/{role}
GET|POST        /api/prestations/{prestation}/team
DELETE          /api/prestation-team-members/{member}
GET             /api/client-team?department_id=            # tous les membres sur toutes les prestations

# Notes — lecture staff (D5 : le staff ne note pas)
GET             /api/prestations/{prestation}/reviews          # notes de toutes ses actions
GET             /api/prestations/{prestation}/reviews/summary
GET             /api/prestations/reviews/summary              # agrégats (package, catégorie, commercial, membre, agence)

# Notes — portail client (groupe `portal:client` existant)
GET             /api/client/prestations                     # prestations du client connecté
GET             /api/client/prestations/{prestation}
GET             /api/client/prestations/{prestation}/actions  # actions de sa prestation + sa note éventuelle
PUT             /api/client/prestation-actions/{action}/review # créer OU modifier SA note sur l'action (1..5 + commentaire)
GET             /api/client/notifications                      # rappels de renouvellement (D18)

# Contrats (existant, à étendre)
GET             /api/contracts?origin=&department_id=&status=
GET             /api/contracts/{contract}/pdf

# Rapports Agency
GET             /api/reports/agency?department_id=&from=&to=
```

Middleware `permission:` sur chaque route (même convention que `routes/api.php`). Tous les `index()` passent par `ScopeService` pour le périmètre.

### 5.4 Automatisations / commandes planifiées 🟡

- Nouvelle commande planifiée `CheckContractRenewalsCommand` (D1 : on ne s'appuie plus sur `CheckSubscriptionExpiryCommand` pour l'Agency) : `markDueSoon()` + `markExpired()` + alertes à **J-30 / J-15 / J-7 / J-1** (configurables, D8) + **destinataires : chef d'agence (notification + tâche de relance) et client (rappel **e-mail + notification portail**)** — D14/D18 (cahier §8.1, §17).
- Contrat expiré ⇒ prestation liée passe en `completed` ou `suspended` (à valider).
- Action en retard (`due_date` dépassée et pas `done`) ⇒ notification au membre assigné + au lead.
- Budget de prestation consommé à 80 % / 100 % ⇒ alerte au lead et au commercial.

### 5.5 Tests (Feature) 🔴
- Souscription à 2 packages ⇒ 2 contrats distincts pour le même client.
- Validation prestation ⇒ 1 contrat avec `budget_allocated = budget`.
- Création d'action dépassant le budget ⇒ 422.
- Changement de statut interdit (ex. `completed → draft`) ⇒ 422.
- Note hors 1..5 ⇒ 422 ; résumé agrégé (moyenne + distribution) correct.
- Un utilisateur staff tente de noter ⇒ 403 ; un client note une prestation qui n'est pas la sienne ⇒ 403.
- Souscription à un package ⇒ prestation créée automatiquement avec une action par item du package.
- Commission calculée à chaque paiement (`on_payment`), pas à la validation.
- Contrat à J-30 / J-15 / J-7 / J-1 ⇒ une alerte à chaque seuil, pas de doublon ; envoyée au chef d'agence et au client, pas au commercial.
- Premier paiement validé ⇒ contrat `pending → active` ; sans paiement le contrat reste `pending` même si un PDF signé est déposé.
- Validation d'une prestation par un commercial ⇒ 403 ; par un chef d'agence hors périmètre ⇒ 403.
- Client note 2 fois la même action ⇒ toujours **1** note (mise à jour), moyenne de la prestation recalculée ; note sur une prestation `draft` ou une action `cancelled` ⇒ 422.
- Prestation hors package avec `commission_type=percent, value=10` ⇒ paiement de 100 000 ⇒ commission 10 000 ; prestation de package ⇒ règle du package appliquée.
- Rappel client de renouvellement ⇒ e-mail envoyé + notification visible dans le portail.
- Migration `subscriptions → contracts` rejouée 2 fois ⇒ aucun doublon.
- Paiement facture de contrat ⇒ commission calculée selon la règle `package_id`.
- Bilan du jour inclut les ventes Agency et exclut le pass-through du CA.
- Utilisateur hors périmètre ⇒ 403.

---

## 6. Frontend `frontend/` — écrans

Dossier recommandé : `frontend/src/pages/agency/` (existe déjà). API : `frontend/src/api/` (un fichier par ressource : `packages.ts`, `prestations.ts`, `prestationActions.ts`, `clientTeam.ts`, `reviews.ts`). Types : `frontend/src/types/agency.ts`. Libellés : `i18n` (clés `nav.prestations`, `nav.clientTeam`, `nav.prestationTracking`…).

### 6.1 Dashboard Agency 🟡
KPI : CA du mois (hors pass-through), encaissements, créances, nb contrats actifs, contrats à renouveler (J-30), prestations en cours, actions en retard, note moyenne, top commerciaux, top packages.

### 6.2 Packages 🔴 (`AgencyPackagesPage`, `AgencyPackageFormPage`)
- Vue **cartes** façon flyer : groupées par catégorie, nom + accroche, liste des items, bloc « Recommandations », **prix barré** + prix, badge promo active.
- Formulaire : infos générales, catégorie, prérequis, items (liste dynamique : libellé, quantité, fréquence, unité, service lié), recommandations (rôle + quantité), prix barré / prix, période, actif / public.
- Onglet promotions (réutiliser `components/promotions`).
- Bouton **« Souscrire un client »** → modal : client, commercial, date de début, durée (nb de périodes) → crée contrat (+ prestation) → redirection vers le contrat.

### 6.3 Souscriptions 🟡
Liste des **contrats `origin=package`** (D1 : plus de lecture/écriture dans `subscriptions` pour l'Agency) : client, package, prestation générée, période, statut, prochaine échéance. Un client peut apparaître plusieurs fois (plusieurs packages). L'ancienne `AgencySubscriptionsPage` reste accessible en lecture seule (historique) jusqu'à la fin de la migration.

### 6.4 Prestations 🔴 (`PrestationListPage`, `PrestationFormPage`, `PrestationDetailPage`)
- Liste : référence, nom, catégorie, client, commercial, période, budget / consommé (barre de progression), statut, note ★.
- Formulaire : catégorie, nom, description, client (recherche `/clients/search`), commercial vendeur, période, budget.
- **Fiche prestation** (onglets) :
  1. **Résumé** : infos, budget global / alloué / restant / dépensé, statut + boutons de workflow (Soumettre, Valider, Rejeter, Suspendre, Annuler, Terminer — motif demandé si requis), lien vers le contrat.
  2. **Actions** : tableau éditable (titre, plateforme, quantité × fréquence, budget, assigné, échéance, statut en badge cliquable, commentaire) ; indicateur « budget restant » en direct ; drawer d'une action = commentaires + journal d'exécution + progression.
  3. **Équipe** : membres + rôle Agency + responsable.
  4. **Notes** (lecture seule, D5) : note ★ du client **par action** + commentaire + date de dernière modification ; moyenne de la prestation. Pas de bouton « Noter » côté staff. La note de chaque action est aussi visible dans l'onglet Actions. Le bloc Play Store (grosse moyenne, étoiles, nb avis, barres 5→1) s'affiche sur le **Dashboard**, la fiche **package** et la page **Équipe client** (notes agrégées).
  5. **Factures / paiements** du contrat.
  6. **Historique** (activity log).

### 6.5 Community Management & Publicité 🔴
Vues filtrées des actions (`type = community_management` / `advertising`) toutes prestations confondues : calendrier / liste par semaine, statut, assigné. Publicité : budget pub alloué vs dépensé par client (pass-through).

### 6.6 Grand tableau « Suivi des prestations » 🔴 (`PrestationTrackingPage`)
Tableau principal demandé en réunion :

| Prestations | Notes | Statut | Motif (optionnel) |
|---|---|---|---|
| nom + client + période (lien fiche) | ★ moyenne + nb avis | badge statut (modifiable selon permission) | texte du motif (suspension, annulation, rejet…) |

- Filtres : période, client, catégorie, commercial, statut, note min.
- Tri sur la note et le statut, export Excel/CSV (`ExportController`).
- Changement de statut en ligne → modal motif si statut exige un motif.

### 6.7 Équipe client 🔴 (`ClientTeamPage`)
- Vue globale : chaque employé, ses rôles Agency, le nombre de prestations, la liste des prestations/clients sur lesquels il est affecté, sa charge (nb d'actions ouvertes).
- Filtres par rôle, par client, par prestation.
- Paramétrage des rôles Agency (dans Paramètres du département).

### 6.8 Contrats 🟡 (étendre `ContractListPage` / `ContractDetailPage`)
- Colonnes : numéro, client, origine (Package / Prestation / Manuel), package ou prestation lié, budget alloué, période, statut, renouvellement auto.
- Fiche : 3 parties (Pekegno / agence, client, prestation ou package), échéancier, factures, bouton PDF, actions Suspendre / Résilier / Renouveler.

### 6.9 Factures 🔴 (`AgencyInvoicesPage`)
- **Corriger** l'item de menu (`payments` → `invoices`) et la route (aujourd'hui `payments` affiche `SellerProfilesPage` de l'Academy).
- Réutiliser la logique `AcademyInvoicesPage` filtrée sur le département Agency (+ colonne contrat).

### 6.10 Créances, Commissions, Comptabilité, Bilan du jour 🟡
- Wrappers sur le modèle `AcademyBilanPage` : `AgencyBilanPage` → `<DailyBilanPage fixedAgencyId={agencyId} />`, `AgencyAccountingPage` → `<AccountingPage … />`.
- Créances : `AcademyReceivablesPage` filtrée par département (ou composant générique).
- Commissions : `AcademyCommissionsPage` filtrée (types `package` / `prestation`).

### 6.11 Rapports 🔴 (`AgencyReportsPage`)
Cahier §18 : clients, renouvellements, **revenu récurrent** (MRR = Σ contrats actifs mensualisés), CA par package / catégorie / commercial, taux de renouvellement, prestations par statut, satisfaction (notes), consommation de budget. Exports Excel/PDF/CSV.

### 6.12 Menu & routes
- `navItems.ts` : retirer `academy`, ajouter `subscriptions`, `prestations`, `prestations/tracking`, `client-team`, `invoices`, `commissions`, `accounting`, `bilans` ; garder renouvellements / créances / rapports.
- `router/index.tsx` : déclarer les nouvelles routes et résoudre les conflits (`prospects`, `reports`, `payments`, `receivables`, `planning` en double) via un sélecteur par `department.type`.
- Fiche client (`ClientDetailPage`) : onglets Packages souscrits / Prestations / Contrats.

---

## 7. Parcours critiques à valider (recette)

1. **Package** : créer catégorie → créer package Starter (items, recommandations, 370 000 barré / 299 000) → promo -10 % du 1er au 15 → prix effectif correct.
2. **Souscription multiple** : client X souscrit Starter (3 mois) + Shooting (1 mois) → **2 contrats + 2 prestations auto-générées** (actions = items du package) + factures → paiement partiel → créance → commission commerciale **calculée sur le paiement**.
3. **Prestation** : créer (budget 500 000) → ajouter actions (3 vidéos FB/semaine — 150 000 ; pub FB — 300 000) → tentative action à 100 000 refusée (budget) → soumettre → valider → **contrat créé** avec budget alloué 500 000.
4. **Suivi** : CM change statut des actions, commente, enregistre les réalisations → progression et budget dépensé à jour.
5. **Équipe** : affecter 1 CM + 2 commerciaux (rôles Agency) → visibles dans « Équipe client ».
6. **Notation** : depuis le portail client, le client note les 3 actions de sa prestation en cours (5★, 4★, 3★) → moyenne 4,0 / 3 avis → il modifie la 3ᵉ en 4★ → toujours 3 avis, moyenne 4,3 dans le grand tableau et sur la fiche. Un membre du staff ne peut pas noter ; une prestation `draft` ne peut pas être notée.
7. **Suspension** : suspendre avec motif → motif visible dans la colonne « Motif ».
8. **Renouvellement** : contrat à J-30 → statut « à renouveler » + alerte au **chef d'agence** (+ tâche de relance) et rappel au **client** ; nouvelles alertes à J-15 / J-7 / J-1 → renouveler → contrat enfant.
9. **Bilan du jour** : les encaissements Agency apparaissent ; budget pub client exclu du CA.
10. **Permissions** : un CM ne voit que ses prestations ; un utilisateur d'une autre agence → 403.

---

## 8. Mode de travail — relais sur la todo list

Pas de répartition fixe entre développeurs : **on avance dans l'ordre de la todo list (§11)** et, à la fin de chaque session, on laisse un **rapport** (§13) pour que le suivant reprenne exactement là où on s'est arrêté.

### 8.1 Règles

1. **Prendre la première tâche non cochée** de la todo list (§11), en respectant l'ordre des étapes : une étape dépend des précédentes.
2. **Signaler qu'on la prend** : passer la case à `[~]` avec son prénom et la date, ex. `- [~] (Mike, 2026-10-05) Migration agency_categories`.
3. **Finir proprement** : une tâche est cochée `[x]` seulement si elle est terminée, testée (au minimum à la main ; tests Feature quand ils existent) et sans régression connue.
4. **Si on s'arrête au milieu** : laisser `[~]` et expliquer précisément dans le rapport ce qui est fait / ce qui reste.
5. **Une décision nouvelle** prise pendant le dev ⇒ l'ajouter en §3 (D19, D20…) et la mentionner dans le rapport.
6. **Une question qui bloque** ⇒ l'ajouter en §12.2 et passer à la tâche suivante non dépendante.
7. **Base de données** : ne pas lancer `migrate` / `seed` / la reprise `subscriptions → contracts` sur une base partagée sans prévenir l'autre ; noter dans le rapport les migrations ajoutées.
8. **Écrire le rapport** (§13) avant de quitter, même pour une courte session.

### 8.2 Modèle de rapport de session

À copier en **haut** du journal (§13), le plus récent en premier :

```markdown
### YYYY-MM-DD — <Prénom>

**Tâches terminées** : #12, #13
**Tâche en cours** : #14 — <ce qui est fait / ce qui reste>
**Fichiers touchés** :
- backend/database/migrations/2026_10_05_000001_create_agency_categories_table.php
- backend/app/Models/AgencyCategory.php
- frontend/src/components/layout/navItems.ts
**Migrations ajoutées (à lancer)** : oui/non — lesquelles
**Décisions prises** : D19 — …  (ajoutée en §3)
**Problèmes / pièges rencontrés** : …
**Questions en suspens** : … (ajoutées en §12.2)
**Prochaine étape conseillée** : #15 — …
**Comment tester ce qui a été fait** : route / page / commande
```

---

## 9. Données de référence — packages du flyer (seed proposé)

Catégorie : **Packages stratégiques mensuels** (`billing_period = monthly`).

| Package | Accroche | Items | Recommandations | Prix barré | Prix |
|---|---|---|---|---|---|
| **Starter** | Lancez votre machine digitale | 01 campagne Facebook & Instagram / mois · Réalisation des supports visuels & vidéos pro · Coaching mensuel du community manager (4 fois/mois) · Script & stratégie de closing pour les commerciaux (4 fois/mois) | 1 CM · 2 commerciaux | 370 000 | **299 000** |
| **Booster** | Accélérer les ventes | 2 à 3 campagnes multi-plateformes (FB, IG) · Supports visuels & vidéos pro · Coaching 1 h/jour (CM + commerciaux) · Tunnel de vente simplifié (pub → lead → relance → vente) | 1 CM · 2 commerciaux | 870 000 | **549 000** |
| **Croissance** | Construire un tunnel de vente | 04 campagnes ciblées + A/B testing · Supports visuels & vidéos pro · Coaching hebdomadaire (CM + équipe commerciale) · Scripts vidéos, tunnels de vente, CRM | 1 CM · 3 commerciaux | 910 000 | **799 000** |
| **Entreprise** | Dominez votre marché | Plan média personnalisé · Formation complète de l'équipe + réalisation des supports visuels et vidéo · Réunions stratégiques mensuelles avec rapport d'impact | 1 CM · 4 commerciaux | 1 490 000 | **999 000** |

Catégorie : **Services à la carte** (prix « à partir de », par mois) :

| Service / package | Prix barré | Prix |
|---|---|---|
| Publicité Facebook | 249 000 | 209 000 / mois |
| Shooting professionnel | — | à partir de 50 000 / mois |
| Shooting et montage vidéo professionnel | — | à partir de 100 000 / mois |
| Égérie pour représenter la marque | — | à partir de 100 000 / mois |
| Influenceur ou influenceuse | — | à partir de 200 000 / mois |

> Ajouter un booléen `price_is_starting_from` sur le package pour l'affichage « À partir de ».

---

## 10. Ordre des étapes (vue d'ensemble)

| Étape | Contenu | Dépend de |
|---|---|---|
| **1** | Socle : menu, routes, permissions, types | — |
| **2** | Modèle de données (migrations + modèles) | 1 |
| **3** | Packages (catalogue, promos) | 2 |
| **4** | Prestations + actions + budget | 2 |
| **5** | Contrats : création depuis prestation / package, activation au 1er paiement | 3, 4 |
| **6** | Souscription package ⇒ contrat + prestation + facture | 3, 4, 5 |
| **7** | Équipe client | 4 |
| **8** | Suivi : grand tableau, CM, Publicité, notifications d'actions | 4, 7 |
| **9** | Notation par action (portail client + lecture staff) | 4 |
| **10** | Finance : factures, créances, commissions, comptabilité, bilan, pass-through | 5, 6 |
| **11** | Renouvellements, alertes, reprise `subscriptions → contracts` | 5 |
| **12** | Dashboard + rapports Agency | 3 → 11 |
| **13** | Tests Feature + recette §7 | tout |

---

## 11. Todo list (à suivre dans l'ordre)

Légende : `[ ]` à faire · `[~] (Prénom, date)` en cours · `[x]` terminé. Les numéros servent à se référer aux tâches dans les rapports (§13).

### Étape 0 — Cadrage
- [x] #0 Décisions D1 → D18 validées (2026-10-03, voir §3)

### Étape 1 — Socle
- [ ] #1 `navItems.ts` : retirer l'item **Academy** du département Agency
- [ ] #2 `navItems.ts` : ajouter Souscriptions, Prestations, Suivi des prestations, Équipe client, Factures, Commissions, Comptabilité, Bilan
- [ ] #3 `router/index.tsx` : routes Agency + résolution des conflits de chemins (`prospects`, `reports`, `payments`, `receivables`, `planning` en double) via sélection par `department.type`
- [ ] #4 Corriger Factures : l'item `payments` affiche aujourd'hui `SellerProfilesPage` (Academy)
- [ ] #5 Permissions `packages.*`, `prestations.*`, `prestation-actions.*`, `equipe-client.*` + attribution aux rôles (`prestations.valider` : chef d'agence + direction, D9)
- [ ] #6 `frontend/src/types/agency.ts` + clés i18n

### Étape 2 — Modèle de données
- [ ] #7 Migration + modèle `agency_categories` (D2)
- [ ] #8 Extension `subscription_packs` (catégorie, accroche, prérequis, prix barré, période, ordre, `price_is_starting_from`…)
- [ ] #9 `package_items`, `package_recommendations`
- [ ] #10 `promotions.package_id`
- [ ] #11 `prestations` (dont `commission_type` / `commission_value`, D17)
- [ ] #12 `prestation_actions`, `prestation_action_comments`, `prestation_action_logs`
- [ ] #13 `client_team_roles`, `prestation_team_members`
- [ ] #14 `prestation_action_reviews` (unique action + client, D11)
- [ ] #15 Extension `contracts` (origine, prestation, budget alloué, commercial, statuts `draft`/`pending`/`renewed`, PDF signé facultatif)
- [ ] #16 `invoices.contract_id`, `invoice_items.package_id` / `prestation_id`, `commission_rules.package_id`

### Étape 3 — Packages
- [ ] #17 API packages + catégories (CRUD, prix effectif avec promo)
- [ ] #18 Pages Packages (cartes façon flyer + formulaire items / recommandations / promos)
- [ ] #19 Seed des packages du flyer (§9) — à valider avant exécution

### Étape 4 — Prestations & actions
- [ ] #20 `PrestationService` : CRUD + workflow de statuts (motif obligatoire pour rejet / suspension / annulation)
- [ ] #21 `PrestationActionService` : CRUD + **blocage strict du budget** (D4) + statuts + commentaires + journal d'exécution
- [ ] #22 Pages Prestations : liste, formulaire, fiche à onglets (Résumé, Actions, Équipe, Notes, Factures, Historique)

### Étape 5 — Contrats
- [ ] #23 `ContractService::createFromPrestation()` — validation d'une prestation ⇒ contrat `pending` avec budget alloué
- [ ] #24 `ContractService::createFromPackage()`
- [ ] #25 Activation au premier paiement validé (hook `PaymentService`, D10)
- [ ] #26 PDF du contrat + étendre `ContractListPage` / `ContractDetailPage`

### Étape 6 — Souscription
- [ ] #27 `PackageService::subscribe()` ⇒ 1 contrat + 1 prestation pré-remplie (actions = items) + facture, par package (D1, D3)
- [ ] #28 Bouton « Souscrire un client » + page Souscriptions (contrats `origin=package`)

### Étape 7 — Équipe client
- [ ] #29 API rôles Agency + membres de prestation + vue globale
- [ ] #30 Page Équipe client + paramétrage des rôles dans Paramètres

### Étape 8 — Suivi
- [ ] #31 Endpoint + page « Suivi des prestations » (Prestations / Notes / Statut / Motif) avec filtres et export
- [ ] #32 Pages Community Management et Publicité (vues filtrées des actions)
- [ ] #33 Notifications : action en retard, budget consommé à 80 % / 100 %

### Étape 9 — Notation
- [ ] #34 Endpoint portail client `PUT /api/client/prestation-actions/{id}/review` (upsert, prestation `in_progress`/`completed`, D11/D12) + recalcul des moyennes
- [ ] #35 Lecture staff + résumés (par prestation et agrégés)
- [ ] #36 Page « Mes prestations » + notation par action dans `frontend_client/`

### Étape 10 — Finance
- [ ] #37 Page Factures Agency (`AgencyInvoicesPage`)
- [ ] #38 Créances (réutiliser `AcademyReceivablesPage` filtrée)
- [ ] #39 Commissions : règle par package + taux saisi sur prestation hors package, au paiement (D6, D13, D17)
- [ ] #40 Budget pub en pass-through : encaissement + décaissement plateformes (D7, D15)
- [ ] #41 `BilanService` : bloc Agency + exclusion du pass-through du CA
- [ ] #42 Wrappers Comptabilité et Bilan du jour (comme Academy)

### Étape 11 — Renouvellements
- [ ] #43 `CheckContractRenewalsCommand` : J-30 / J-15 / J-7 / J-1 configurables (D8), chef d'agence + client (D14)
- [ ] #44 Rappels client : e-mail + notification portail (D18)
- [ ] #45 `subscriptions` en lecture seule + commande `agency:migrate-subscriptions` (tout l'historique, idempotente, D16) — **à valider avant exécution**
- [ ] #46 Étendre `RenewalsPage` aux contrats de packages

### Étape 12 — Pilotage
- [ ] #47 Dashboard Agency (KPI §6.1)
- [ ] #48 Rapports Agency (§6.11) + exports
- [ ] #49 Fiche client : onglets Packages / Prestations / Contrats

### Étape 13 — Qualité
- [ ] #50 Tests Feature §5.5
- [ ] #51 Audit (`ActivityLogger`) sur validation, statuts, budget, notes, résiliation
- [ ] #52 Recette des parcours §7

---

## 12. Questions ouvertes (à poser à la direction)

### 12.1 Réponses déjà obtenues (2026-10-03)

| Question | ✅ Réponse |
|---|---|
| La note 5★ est-elle donnée par le client ou saisie en interne ? | **Client uniquement**, via le portail client (D5). |
| Un package souscrit génère-t-il automatiquement une prestation ? | **Oui**, pré-remplie avec les items du package comme actions (D3). |
| Actions dépassant le budget : blocage ou dépassement autorisé ? | **Blocage strict** (D4). |
| Commission sur prestation : au paiement ou à la validation ? | **Au paiement** (`on_payment`) (D6). |
| Délais d'alerte de renouvellement ? | **J-30 / J-15 / J-7 / J-1**, configurables (D8). |
| Budget pub client : CA ou pass-through ? | **Pass-through**, exclu du CA ; honoraires = CA (D7, à confirmer avec la finance). |
| `subscriptions` à côté de `contracts` ? | **Contrat central**, `subscriptions` en lecture seule puis migration (D1). |
| Catégories packages/prestations ? | **Nouvelle table `agency_categories`** (D2). |
| Qui valide une prestation ? | **Chef d'agence + direction générale** (D9). |
| Signature ou premier paiement pour activer le contrat ? | **Premier paiement** ; PDF signé facultatif (D10). |
| Le client note une fois ou par période ? | **Une note par action**, modifiable quand il veut (D11). |
| À partir de quel statut le client peut noter ? | **`in_progress` ou `completed`** (D12). |
| Taux de commission par package ou par catégorie ? | **Par package** (D13). |
| Destinataires des alertes de renouvellement ? | **Chef d'agence + client** (D14). |
| Le budget pub transite-t-il par Pekegno ? | **Oui** → pass-through en trésorerie (D15). |
| Reprise `subscriptions → contracts` : quoi migrer ? | **Tout l'historique** (D16). |
| Commission des prestations hors package ? | **Taux saisi sur la prestation** (D17). |
| Limite sur les notes ? | **Une note par action, modifiable** — pas de spam possible (D11). |
| Canal du rappel client ? | **E-mail + notification portail** (D18). |

### 12.2 Questions encore ouvertes

Aucune pour l'instant ✅ — toutes les décisions D1 → D18 sont validées. Ajouter ici les nouvelles questions au fil du développement.

---

## 13. Journal des rapports de session

Le plus récent en haut. Modèle : §8.2.

### 2026-10-03 — Cadrage

**Tâches terminées** : #0 (décisions D1 → D18)
**Tâche en cours** : —
**Fichiers touchés** : `doc/AGENCY_A_FAIRE.md` (création)
**Migrations ajoutées** : non
**Prochaine étape conseillée** : #1 — retirer Academy du menu Agency, puis #2 → #6 (socle)

