# TODO pour le collègue — Agency (commercial / caissier / "catalogue packages")

Cette todo reprend l’existant (migrations, services, contrôleurs) et ajoute uniquement ce qui manque. Respecte bien les règles de `/home/mike/Documents/PEKEGNO/pekegno/doc/AGENCY_A_FAIRE.md`.

Les numéros sont à utiliser dans le journal de session (§13).

## Contexte (rappels)

- Client portal : `/frontend_client/` — « Mes prestations » existe, il note chaque action (5★, upsert). Pas de souscription packages côté client pour l’instant.
- Backend: `packages` et `prestations` existent déjà (voir migrations 2026_10_03_*). `PackageService::subscribe` créé contrat + prestation **validée** + facture + paiement avancé possible. `PrestationService::submit/validate` existe (validation => contrat+facture).
- Staff frontend: pages Agency existantes (prestations, packages, contracts, tracking, client-team, actions). `PrestationReviewService` gère les notes par action (moyenne des actions).
- Autorisations: `responsable-agence` + `direction-generale` ont `prestations.valider` (D9). Commercial: `prestations.creer`. Caissier: `prestations.consulter` (et factures).

## 1. Décisions à appliquer (issues de la discussion)

- **D23 — Note prestation**: si le client note **directement la prestation** (nouvel endpoint/UX), la **note directe est prioritaire** pour l’affichage de `prestations.rating_avg` ; la moyenne des notes d’actions reste dans `prestation_action_reviews` et peut servir au détail. (Si on n’ajoute pas encore la note directe, conserver le comportement actuel. À mettre en place si demandée ou sur ce point précis.)
- **D24 — Périmètre "Catalogue Packages"**: l’onglet **Packages** dans le catalogue **staff** (et dans le **portail client** si on l’expose) = **toute la plateforme** (filtrer par agence/ville uniquement si nécessaire). Dans la **page Packages** de l’Agence (dept), on continue à gérer les packages du département courant (logique existante).

## 2. Catalogue Staff — ajouter onglet « Packages »

Objectif: exposer un onglet **Packages** dans le catalogue staff (global `/catalog/services` ou sous `/catalog/*`) pour que **commerciaux** et **caissiers** puissent voir les packages de la plateforme et **souscrire un client**.

- [ ] **C1** — Étendre `ServiceListPage` (`frontend/src/pages/services/ServiceListPage.tsx`)
  - Ajouter tab `packages` (à côté de `services`/`formations`) quand pertinent (staff global/catalog). 
  - Quand `tab==='packages'`, afficher grille de `packages` (cartes) — reprendre visuel des cartes packages (nom, code, prix, période, catégorie, promo éventuelle).
  - Afficher bouton **« Souscrire un client »** sur chaque carte si utilisateur a le droit: au minimum `commercial` et `caissier` (et aussi managers). 
  - Ouvrir un modal **`PackageSubscribeModal`** (à créer) pré-rempli avec package + champs: `client` (recherche), `commercial_id` (auto pour commercial, modifiable selon rôle), `department_id` (département Agency pertinent), `start_date`, `periods` (défaut 1), `auto_renew`, `advance`, `payment_type`, `treasury_account_id`. 
  - À la soumission, appeler `agencyDepartmentApi.subscribe(package.id, payload)` (déjà exposé) et afficher toast + rediriger vers contrat/plus d’infos.

- [ ] **C2** — Modal `PackageSubscribeModal` (`frontend/src/components/packages/PackageSubscribeModal.tsx`)
  - Champs requis: client, periods. 
  - Pour `commercial`: forcer `commercial_id` à son propre commercial (déjà géré côté backend mais mieux côté UI). 
  - Pour `caissier`: autoriser sélection d’un commercial. 
  - `advance` + `payment_type` (cash/om/momo/mobile) + `treasury_account_id` — **saisie directe (encaissement réel)** conformément à la décision.
  - Validation basique, désactiver bouton si formulaire invalide.

- [ ] **C3** — API helpers si besoin
  - S’appuyer sur `frontend/src/api/agencyDepartment.api.ts.subscribe`. Pas de nouveau fichier requis.
  - Si besoin de recherche clients: utiliser `clientsApi` existant.

- [ ] **C4** — Permissions UI
  - Afficher onglet `packages` dans le catalogue staff pour: `super-admin`, `direction-generale`, `responsable-agence`, `responsable-departement`, `commercial`, `caissier`. 
  - Masquer pour `comptable` sauf si explicitement voulu ? Vérifier comportement existant (catalogItem visible pour comptable selon navItems — ok). 
  - Bouton souscription: autoriser `commercial` et `caissier` (min). Managers ok.

- [ ] **C5** — i18n
  - Ajouter clés: `nav.packages`, `packages.subscribeClient`, etc si manquantes (déjà présentes en partie).

## 3. Portail client — catalogue Packages + accès

Objectif: exposer **Packages** dans le portail client (décision « Les deux »). Comme l’info est « packages de la plateforme » (D24), afficher **packages publics actifs** de l’ensemble des agences (avec possibilité de filtrer par pays/agence).

- [ ] **PC1** — Backend public pour packages
  - Ajouter dans `PublicCatalogController` (`backend/app/Http/Controllers/Api/Public/PublicCatalogController.php`) ou créer un endpoint dédié:
    - `GET /api/public/packages` — paramètres: `search`, `agency_id`, `country_id` (si souhaité), `per_page` (optionnel). Retourner packages `is_public=true` AND `is_active=true`, avec relations: `agency:id,name`, `category:id,name`, `items`, `promotions`, `recommendations.teamRole` (light). 
  - Filtrer par périmètre « plateforme » (D24) — donc **pas** restreint au département client. 

- [ ] **PC2** — API client public
  - Ajouter `publicApi.packages(params)` dans `frontend_client/src/api/public.api.ts`.

- [ ] **PC3** — Onglet Packages dans catalogue client
  - Dans `frontend_client/src/components/catalog/CatalogSection.tsx` (ou page Home/catalog), ajouter 4e onglet `packages` (Services/Produits/Formations/Packages).
  - Grille cartes: nom, tagline/prérequis, prix barré + prix effectif (avec promo active), période, agence si multiple.
  - Lien vers détail package (nouvelle page) ou afficher actions limitées (client ne souscrit pas via portal — staff seul). Afficher « Contacter l’agence » ou juste consultation. **Ne pas ajouter bouton « Souscrire » côté client.**

- [ ] **PC4** — Détail package côté client (optionnel mais pratique)
  - Créer `frontend_client/src/pages/public/PackageDetailPage.tsx` + route `/packages/:id` ou `/produits/packages/:slug`. Afficher items, recommandations, promotions.

- [ ] **PC5** — i18n client
  - Ajouter clés `packages.title`, `packages.empty`, etc.

## 4. Prestation — preuve d’avance/paiement complet à la soumission (commercial/caisse)

Décision: **Encaissement réel**. Quand le **commercial** soumet une prestation avec preuve d’avance (ou paiement complet), le backend doit:
- créer la **facture** de la prestation (déjà fait si validée, mais ici **soumission**), 
- enregistrer le **paiement** via `PaymentService::applyPayment` (avec `isAdvance=true` ou false selon montant payé),
- attacher la **preuve** (fichier uploadé) — idéalement créer un `PaymentProof` lié à la facture (workflow existant: pending/accepted/rejected) OU simplement stocker le fichier et marquer le paiement comme déclaré avec preuve.

Actuellement `PrestationService::submit()` ne fait que transition. `PrestationService::validate()` crée contrat+facture. 

**Recommandation**: étendre le flux **« soumettre avec preuve »**:
- Permettre au **commercial** (et si souhaité caissier) de renseigner à la soumission: `amount_paid`, `payment_type`, `treasury_account_id`, `proof_file`. 
- Côté backend: à la soumission `pending_validation`, si `amount_paid > 0`, générer immédiatement **facture de prestation** (si pas encore), créer `InvoicePayment` (avance ou solde selon) ET créer `PaymentProof` en `pending` avec fichier + `declared_amount`. 
- L’admin/chef d’agence voit la preuve dans la fiche prestation + dans « Factures en attente de validation » (invoices pending proofs). 
- La validation de la prestation peut rester séparée ; l’acceptation de la preuve reste via le workflow `PaymentProof` existant.

Implémentation concrète:

- [ ] **P1** — Migration `prestations` (ajout champs optionnels)
  - Ajouter `declared_advance_amount` decimal(15,2) nullable
  - Ajouter `declared_total_paid` boolean default false
  - Ajouter `payment_proof_id` uuid nullable FK `payment_proofs(id)` (facultatif)
  - Ajouter `submitted_with_proof_at` timestamp nullable
  - **Ne pas casser l’existant** (migrate safe).

- [ ] **P2** — Étendre `PrestationService::submit()` 
  - Accepter `$options` (ou payload): `amount_paid`, `payment_type`, `treasury_account_id`, `proof_file` (UploadedFile), `actor`.
  - Si preuve fournie: 
    - vérifier droits (`commercial` ou `responsable-agence`/direction selon besoin) — `commercial` a `prestations.creer` donc ok.
    - créer facture si `contract_id` inexistant ? (validation crée contrat+facture ; soumission sans validation ≠ idéal). Alternative: **créer facture à la soumission** quand preuve présente (même logique que `AgencyInvoicingService::invoiceForPrestation`), lier à prestation/contrat.
    - appliquer paiement via `PaymentService::applyPayment($invoice, $amount_paid, $payment_type, $isAdvance = ($amount_paid < invoice->total), $actor->id, $treasuryAccountId)`.
    - créer `PaymentProof` (model existant) en `pending`, `file_path` via `UploadController`/storage, lier à `$invoice->id`, `submitted_by = $actor->id`, `payment_method = $payment_type`, `declared_amount = $amount_paid`.
    - journaliser via `ActivityLogger`.

- [ ] **P3** — Étendre API `POST /prestations/{id}/submit`
  - `backend/routes/api.php:500` — middleware `prestations.creer` ok. 
  - Dans `PrestationController::submit()` accepter `amount_paid`, `payment_type`, `treasury_account_id`, `proof` (multipart). 
  - Passer au `PrestationService::submit($prestation, $data, $request->file('proof'), $request->user())`.

- [ ] **P4** — Frontend: formulaire de soumission avec preuve
  - Dans `PrestationDetailPage.tsx` (staff), quand on clique « Soumettre » (bouton visible selon statut) — ouvrir modal `SubmitWithProofModal` si rôle `commercial` (ou si on veut l’imposer quand avance demandée). 
  - Champs: montant payé, mode de paiement, compte de trésorerie (si dispo), fichier preuve (jpg/png/pdf/jpg/webp). 
  - Appeler `agencyDepartmentApi.transition` étendu OU ajouter méthode `submitWithProof`. 
  - Actuellement `agencyDepartmentApi.transition(id,'submit', reason)` — étendre pour envoyer FormData.

- [ ] **P5** — API client étendu (si besoin)
  - `frontend/src/api/agencyDepartment.api.ts` — ajouter `submitWithProof(prestationId, formData)` utilisant `post` avec `multipart/form-data`.

## 5. Notes prestation — note directe (si appliquée) + affichage prioritaire (D23)

D23: **note directe prioritaire**. Actuellement seule la moyenne des notes d’actions existe (`prestation_action_reviews` → `prestations.rating_avg/rating_count`).

Si on ajoute une **note globale** donnée par le client sur la prestation elle-même:

- [ ] **N1** — Migration `prestations`
  - Ajouter `client_direct_rating` tinyint nullable (1-5)
  - Ajouter `client_direct_comment` text nullable
  - Ajouter `client_direct_rated_at` timestamp nullable
  - Ajouter `client_direct_rated_by` uuid nullable FK users
  - Index sur `client_direct_rating`.

- [ ] **N2** — Méthode pour obtenir la note à afficher
  - Ajouter accesseur `display_rating_avg` (ou logique dans service) : si `client_direct_rating` non null → `client_direct_rating` ; sinon `rating_avg` (moyenne actions). 
  - Idem pour `display_rating_count` : si direct → 1 ; sinon `rating_count`. 

- [ ] **N3** — Endpoint portail client
  - Ajouter `PUT /api/client/prestations/{prestation}/review` (ou `rate`) dans `ClientPrestationController` (middleware `portal:client`). 
  - Autoriser uniquement le client de la prestation ; `isRateable()` requis (in_progress/completed) comme pour actions.
  - Upsert: stocker `client_direct_rating`, `client_direct_comment`, `client_direct_rated_at`, `client_direct_rated_by = $request->user()->id`. 
  - Recalculer affichage (pas besoin de recalculer moyenne actions). 
  - Journaliser.

- [ ] **N4** — Frontend client
  - Dans `PrestationsPage.tsx`, ajouter bloc « Noter la prestation globale » (étoiles + commentaire) au-dessus ou en dessous des actions. Permettre modification si déjà notée. 
  - Appeler nouvel endpoint.

- [ ] **N5** — Frontend staff
  - Dans `PrestationTrackingPage` et `PrestationDetailPage`, afficher `display_rating_avg/display_rating_count`. 
  - Dans résumé reviews: indiquer « Note globale » vs « Moyenne des actions ».

- [ ] **N6** — Mise à jour de `PrestationReviewService::summaryForPrestation` (facultatif)
  - Retourner aussi `has_direct_rating`, `direct_rating`.

**Important**: si D23 n’est pas encore activé en prod, **ne pas casser** le comportement existant. Ajouter feature flag logique (présence du champ suffit).

## 6. Caissier — souscription packages + création/validation prestations (contexte demandé)

Demande: « le caissier qui pourras directement creer ett valider les prestation, vendre des packages etc »

Actuellement:
- Caissier: `packages.consulter`, `prestations.consulter` (seeder/migration grants). 
- Ne peut pas `creer/modifier/valider` prestations. 
- Peut encaisser (invoices.encaisser/valider) mais pas vendre packages hors ventes facturées.

Pour que le **caissier** puisse:
- souscrire un package (staff/catalogue ou depuis `AgencyDeptPackagesPage`) — `POST /packages/{id}/subscribe` exige `prestations.creer` (route ligne ~488). 
- créer et **valider** directement des prestations — `prestations.creer` + `prestations.valider`.

Actions:

- [ ] **K1** — Permissions backend (migrations/seeders)
  - Mettre à jour `database/seeders/RoleSeeder.php` (caissier) pour ajouter:
    - `packages.consulter` (déjà) + éventuellement `packages?` non requis pour souscrire via route `prestations.creer`? Route subscribe est `permission:prestations.creer` — donc caissier doit avoir `prestations.creer`. 
    - `prestations.creer`, `prestations.valider` (pour créer+valider directement)
    - `prestation-actions.*` si nécessaire (lecture ok, création selon besoin)
    - `contrats.consulter/creer/modifier` selon usage (déjà consulter)
  - Ajouter migration `2026_10_03_000013_grant_cashier_agency.php` (idempotente) pour accorder ces perms aux rôles `caissier` existants (même approche que `000011`).

- [ ] **K2** — Frontend UI
  - Dans `ServiceListPage` onglet packages: bouton « Souscrire un client » **déjà** prévu pour `commercial`+`caissier` (C4).
  - Dans `AgencyDeptPackagesPage.tsx`: bouton souscription visible pour `canCreatePrestation(user)` OU aussi `caissier`. Vérifier `canCreatePrestation` (utils: commercial + managers) — étendre si besoin pour `caissier`.
  - Dans `PrestationListPage`: bouton « Nouvelle prestation » visible pour `caissier` si `canCreatePrestation` étendu.
  - Dans `PrestationDetailPage`: boutons workflow — `canValidatePrestation` autorise responsables-agence + direction-générale. Ajouter `caissier` ? Demande « directement creer ett valider » → autoriser `caissier` à valider **ses** prestations ou **toutes** du périmètre ? 
    - Scoper par périmètre (AgencyAccessService) — caissier voit selon périmètre factures/clients. 
    - Étendre `canValidatePrestation` (`frontend/src/utils/agencyDeptPermissions.ts`) pour inclure `caissier`? Ou restreindre à responsables. À valider avec direction, mais implémenter prudemment: **ajouter `caissier`** pour validation directe demandée.

## 7. Commercial — soumettre avec preuve (UI + UX)

- [ ] **CM1** — Modal `SubmitWithProofModal` (réutilisable) 
  - Props: prestationId, budget, canSkipProof? 
  - Champs: `amount_paid` (number, min 0.01), `payment_type` (select), `treasury_account_id` (select si comptes existants), `proof_file` (file input). 
  - Validation: si montant > 0 → fichier requis ? Ou selon règle (conventionnel). 
  - Afficher info: « Encaissement réel » (décision).

- [ ] **CM2** — Intégration dans `PrestationDetailPage`
  - Quand statut `draft` et utilisateur `commercial`/`responsable-agence`/`caissier` → bouton « Soumettre avec preuve » (primaire) + « Soumettre sans preuve » (secondaire) ? Ou un seul bouton ouvrant modal. 
  - Appeler `agencyDepartmentApi.submitWithProof`.

- [ ] **CM3** — API method
  - `frontend/src/api/agencyDepartment.api.ts`:
    ```ts
    submitWithProof: (id: string, data: FormData) => post<{data: Prestation}>(`/prestations/${id}/submit`, data, { headers: {'Content-Type':'multipart/form-data'} })
    ```
  - Ou étendre `transition`.

## 8. Affichage « Motif » dans Suivi + tracking

Déjà présent dans `PrestationTrackingPage` (colonne Motif, statut_reason). Vérifier cohérence avec `PrestationDetailPage` (affiche status_reason). Ok.

## 9. Tests rapides à prévoir

- [ ] **T1** — Package subscribe via catalogue staff (commercial + caissier) → contrat pending + prestation validée + facture + paiement éventuel.
- [ ] **T2** — Soumission avec preuve (commercial) → facture créée + paiement créé + PaymentProof pending + statut pending_validation.
- [ ] **T3** — Caissier peut valider prestation (si perms accordées).
- [ ] **T4** — Onglets packages visibles selon rôles.
- [ ] **T5** — Portail client voit onglet Packages (si PC3 fait).

## 10. Ordre conseillé d’exécution

1. **Catalogue staff (C1–C5)** — indépendant, visible vite.
2. **Portail client packages (PC1–PC5)** — public endpoint + UI.
3. **Permissions caissier (K1–K2)** — backend d’abord, puis UI.
4. **Soumission avec preuve (P1–P5, CM1–CM3)** — impact backend+frontend, à bien tester avec `applyPayment`/commissions.
5. **Note directe (N1–N6)** — optionnel si pas strictement requis maintenant (D23). Peut être reporté.

## Notes importantes

- **Ne pas lancer `migrate`/`seed` sur base partagée sans accord** (rappel doc). Créer migrations idempotentes.
- Respecter **D1**: souscription package = contrat central. `subscriptions` en lecture seule.
- **Commission**: déjà déclenchée au paiement (`PaymentService` + commissions) — si on applique paiement à la soumission, ça doit déclencher correctement (voir `CommissionService`).
- **Upload**: réutiliser `UploadController` existant (`POST /uploads`) ou `Storage::disk('public')`. Vérifier taille/types.
- **Périmètre**: `AgencyAccessService` doit rester cohérent (caissier a périmètre factures/clients).
