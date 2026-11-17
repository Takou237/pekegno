# TODO — Corrections demandées par Daniel (2026-11-16)

Branche : `corrections`. **Aucune modification de code n'a encore été faite** : ce document est
la synthèse de deux audits en lecture seule (preuves/factures, dépenses/caisses) + trois
vérifications complémentaires (sessions, utilisateurs, suivi des ventes).

Chaque ligne indique : ce qui existe aujourd'hui dans le code, ce qu'il faut changer, les
fichiers, l'effort et les dépendances.

Légende effort : **S** ≈ 1 h · **M** ≈ 2–4 h · **L** ≈ 1 j ou plus.

---

## État d'avancement

- [x] **5** — badge « Annulée » basé sur `is_cancelled`, bloc « Validée par » remplacé par la date d'annulation.
      `is_cancelled` manquait dans `$appends` du modèle `Invoice` : l'API ne le renvoyait pas, le front
      retombait donc toujours sur « Validée le … ». Corrigé (constaté sur PK-20261031-059).
- [x] **6** — motif de rejet affiché en tête du détail de facture + motif de la preuve (`rejection_code`).
- [x] **7** — bouton « Annuler la facture » piloté par `invoices.annuler` (`canCancelInvoices` / `canCancelInvoice`).
- [x] **9** — commercial : annulation de sa facture sans motif tant que `amount_paid = 0`
      (migration `2026_11_16_000001_grant_invoice_cancel_to_commercial.php` pour les bases existantes),
      motif par défaut journalisé.
- [x] **4** — rejet d'une preuve : premier paiement (`amount_paid = 0`) → facture annulée via
      `InvoiceCancellationService` ; règlement du reste → seule la preuve est rejetée, la facture
      partielle reste intacte.
- [x] **8** — un seul bouton « Encaisser » par preuve (détail de facture, page des preuves), qui
      ouvre la preuve avec deux actions : « Encaisser » et « Annuler » (motif obligatoire).
- [x] **3** — preuves servies par `GET /api/payment-proofs/{proof}/file` (route signée, 12 h) ;
      `PaymentProof::getFileUrlAttribute` renvoie cette URL au lieu de `/storage/...` ;
      `storage:link` ne masque plus son échec (`docker/entrypoint.sh`).
      *La production est sur o2switch (disque persistant) : pas de stockage objet à mettre en place ;*
      *le diagnostic « disque éphémère » ne concernait que `render.yaml`, qui n'est plus utilisé.*
- [x] **2** — durée de session réglable : `InactivityLogout` lisait déjà `session_lifetime_minutes`
      (24 h par défaut, 12 h pour la direction) mais le réglage n'était ni exposé par l'API ni
      éditable : ajouté à `SettingController` (30 min – 7 j) et à Paramètres → Général, section
      « Sécurité » (saisie en heures).
- [x] **1** — édition d'un utilisateur depuis Paramètres › Utilisateurs : `PUT /api/users/{user}`
      (`UpdateUserRequest`, `UserController::update`), formulaire avec nom, prénom, **nom d'utilisateur**,
      email, téléphone, rôle, pays, agence, département et actif.
- [x] **10** — nouveau formateur : `TrainerController::availableUsers` liste tous les comptes internes
      de l'agence (hors clients), le rôle est affiché dans la liste ; `linkUser` n'interdit que les clients.
- [x] **11** — suivi des ventes : le commercial (et le community manager) voit aussi les ventes
      inter-agences dont il est le vendeur ; le filtre d'agence ne s'applique plus à lui.
- [x] **12** — `ExpenseService::pay` refuse une dépense supérieure au solde : 422
      « Solde insuffisant dans cette caisse. ».
- [x] **13** — dépenses modifiables avant paiement (`draft|submitted|approved|rejected`) et annulables
      (`POST /expenses/{expense}/cancel`). Une dépense payée est contre-passée en trésorerie et son
      écriture comptable est retirée ; `cancelled_at`/`cancelled_by` + `is_cancelled` (pas de nouveau
      statut : contrainte CHECK incompatible PostgreSQL 9.6/SQLite). Front : crayon, bouton annuler,
      badge « Annulée », modales d'édition et de confirmation.
- [x] **14a** — `POST /api/treasury/closings/close-all` et `/reopen-all` (périmètre de l'utilisateur) +
      boutons « Tout clôturer » / « Tout rouvrir » sur la page des caisses.
- [x] **14b** — commandes `treasury:auto-close` / `treasury:auto-reopen` appelées chaque minute ;
      horaires et activation réglables dans Paramètres › Général › « Caisses automatiques »
      (`cash_auto_closing_enabled`, `cash_closing_time`, `cash_reopening_time`).

Tests au moment de cette note : `php artisan test --filter="Invoice|PaymentProof|Proof"` → **154 ✓**
(dont `PaymentProofFileTest` : URL signée qui sert le fichier, requête non signée refusée, fichier absent → 404)
et `--filter=SessionLifetimeByRoleTest` → **6 ✓** (dont réglage de la durée via `/api/settings`).
Nouveaux tests : `test_a_commercial_cancels_his_unpaid_invoice_without_a_reason`,
`test_rejecting_the_first_payment_cancels_the_invoice`,
`test_rejecting_the_remaining_payment_does_not_cancel_the_invoice`.

---

## Vue d'ensemble

| # | Demande | Domaine | Effort | Lot |
|---|---------|---------|--------|-----|
| 1 | Modifier un profil utilisateur depuis les paramètres admin | Admin | M | B |
| 2 | Session active 24 h, durée réglable | Admin / sécurité | M | B |
| 3 | Images des preuves de paiement non affichées | Factures | L | A |
| 4 | Rejet d'une preuve : annule la facture si premier paiement, sinon seulement le paiement | Factures | M | A |
| 5 | Facture annulée affiche « Validé par … » au lieu de « Annulée » | Factures | S | A |
| 6 | Afficher le motif de rejet dans le détail de facture | Factures | S | A |
| 7 | Bouton « Annuler » : permission + désactivation si déjà annulée | Factures | S | A |
| 8 | Un seul bouton « Encaisser » (ouvre la preuve → Encaisser / Annuler avec motif) | Factures | M | A |
| 9 | Le commercial annule sa facture sans motif tant qu'elle n'est pas encaissée | Factures | S | A |
| 10 | « Nouveau formateur » : lister tous les utilisateurs de l'agence | Académie | S | C |
| 11 | Vente d'un produit d'une autre agence visible dans le suivi des ventes du commercial | Ventes | M | D |
| 12 | Interdire une dépense supérieure au solde de la caisse | Caisses | M | E |
| 13 | Modifier et annuler une dépense | Caisses | L | E |
| 14a | Boutons « clôturer / rouvrir toutes les caisses » | Caisses | M | E |
| 14b | Fermeture auto 22 h / ouverture auto 7 h, horaires réglables | Caisses | L | E |

Ordre recommandé : **A (5 → 6 → 7 → 9 → 4 → 8 → 3)** → **C** → **B (2 puis 1)** → **D** → **E (12 → 13 → 14a → 14b)**.

Raison : le lot A touche le cœur métier (encaissement) et contient les corrections les plus
visibles et les moins risquées ; le lot E est le plus lourd et le plus structurant (statut de
dépense, mouvements de trésorerie, tâches planifiées, fuseaux horaires) : il mérite d'être
attaqué quand le reste est stabilisé.

---

## Lot A — Factures & preuves de paiement (points 3 à 9)

### A1 — Point 5 : factures annulées affichées comme « Validées » · S

**Aujourd'hui** — dans le détail, le badge utilise `invoice.status` :
`frontend/src/pages/invoices/InvoiceDetailPage.tsx` l. 700-707. Or `Invoice::refreshStatus()`
(`backend/app/Models/Invoice.php` l. 215-223) ne force `cancelled` que si `cancelled_at` est
renseigné ; les factures annulées **avant** l'introduction de ce comportement gardent
`status = validated`, et le bloc de validation (« Validé par <commercial>, le … ») reste affiché
(l. 784-795). La liste, elle, utilise déjà `is_cancelled`
(`frontend/src/pages/invoices/InvoiceListPage.tsx` l. 378).

**À faire**
- Détail : se baser sur `invoice.is_cancelled` (comme la liste) pour le badge et le bandeau.
- Quand la facture est annulée : afficher « Annulée le … par … » et **masquer** le bloc
  « Validé par / Validé le », ainsi que les boutons d'action restants.
- Vérifier la cohérence dans `PendingInvoicesPage.tsx` et `PaymentProofsPage.tsx`.
- Facultatif mais conseillé : une migration de données qui réaligne `status = 'cancelled'` sur
  `cancelled_at IS NOT NULL` (en `DB::statement`, compatible PostgreSQL 9.6 — voir `CLAUDE.md`).

### A2 — Point 6 : motif de rejet invisible · S

**Aujourd'hui** — `invoices.rejection_reason` n'est affiché nulle part côté staff (seulement
portail client, e-mails et PDF), et `payment_proofs.rejection_code` n'est jamais rendu : le détail
n'affiche que `proof.notes` (`InvoiceDetailPage.tsx` l. 973-975).

**À faire**
- Dans le détail de facture, quand `validation_status = rejected` : afficher la date et le motif
  (`invoice.rejection_reason`), avec le libellé lisible du `rejection_code` de la dernière preuve
  rejetée.
- Même information dans la fiche de preuve (`PaymentProofsPage`).
- Attention : `PaymentProofRejectionReasonTest.php` existe déjà — le garder vert.

### A3 — Point 7 : bouton « Annuler » sans contrôle de permission · S

**Aujourd'hui** — le bouton (`InvoiceDetailPage.tsx` l. 737-742) est piloté par le rôle et
l'état, jamais par `invoices.annuler` (permission utilisée côté route :
`backend/routes/api.php` l. 334). `frontend/src/utils/invoicePermissions.ts` ne connaît que
`canValidateInvoices` (rôles codés en dur, ignore même `invoices.valider`).

**À faire**
- Ajouter `canCancelInvoices(user)` dans `invoicePermissions.ts`, basé sur
  `user.permissions.includes('invoices.annuler')` avec repli sur les rôles actuels.
- Masquer le bouton sans permission ; le griser/désactiver avec infobulle « Facture déjà
  annulée » si `is_cancelled`.

### A4 — Point 9 : annulation par le commercial sans motif · S

**Aujourd'hui** — `InvoiceController::cancel` (l. 1154-1208) : le motif est **toujours**
obligatoire (l. 1173-1179) et un commercial ne peut annuler que ses factures **non validées**
(l. 1162-1166).

**À faire**
- Nouvelle règle : commercial + facture qui lui appartient + **non encaissée**
  (`amount_paid = 0`) → annulation autorisée, motif facultatif (valeur par défaut tracée du type
  « Annulée par le commercial »).
- Remplacer le critère `validation_status = validated` par `amount_paid = 0` (demande explicite :
  « tant qu'elle n'est pas encaissée »).
- Garder le motif obligatoire pour les autres rôles et dès qu'un montant a été encaissé.
- Mettre à jour la modale front (motif non requis dans ce cas) et les tests d'annulation.

### A5 — Point 4 : cascade du rejet d'une preuve · M

**Aujourd'hui** — `PaymentProofController::reject` (l. 354-381) rejette la preuve et appelle
`markInvoiceRejected` (l. 562-584) : la facture repasse en `rejected`, **mais** une facture déjà
validée/encaissée n'est jamais annulée, et l'inverse (facture annulée alors qu'il fallait
seulement invalider le paiement) n'est pas géré.

**À faire** — au rejet d'une preuve, deux cas :
1. **Premier paiement** (`invoice.amount_paid = 0`, facture en attente ou validée sans
   encaissement) → annuler la facture via `InvoiceCancellationService::reverseFinancials`
   (motif = motif de rejet), en réutilisant la logique de `InvoiceController::cancel`
   (souscription, inscription liée, client créé pour l'occasion).
2. **Paiement complémentaire** (`amount_paid > 0`) → **ne pas** annuler la facture : rejeter
   seulement la preuve. Comme la preuve n'a pas encore généré de paiement, il n'y a rien à
   contre-passer ; la facture reste partiellement payée avec son reste dû.
- Écrire les deux cas dans les tests (facture impayée → annulée ; facture partielle → intacte).

### A6 — Point 8 : un seul bouton « Encaisser » · M

**Aujourd'hui** — boutons « Accepter » / « Rejeter » par preuve dans le détail
(`InvoiceDetailPage.tsx` l. 978-992), sur la page des preuves
(`PaymentProofsPage.tsx` l. 364-375) et depuis les factures en attente
(`PendingInvoicesPage.tsx` l. 460-465).

**À faire**
- Remplacer par un unique bouton **« Encaisser »** qui ouvre la preuve (image + infos) dans une
  modale, avec deux actions : **Encaisser** (ex-`approve`) et **Annuler** (ex-`reject`, motif
  obligatoire).
- Garder les endpoints backend (`POST /payment-proofs/{proof}/approve|reject`) : c'est un
  changement d'interface, pas d'API.
- Prévoir l'état sans image (A1 non livré) : afficher un lien « Ouvrir la preuve » au lieu d'un
  cadre cassé.

### A7 — Point 3 : images des preuves de paiement cassées · L ⚠️ dépendance externe

**Cause identifiée** (trois facteurs qui se cumulent) :
1. `PaymentProof::getFileUrlAttribute` (`backend/app/Models/PaymentProof.php` l. 65-68) renvoie
   une **URL absolue** construite depuis `APP_URL` (`http(s)://backend…/storage/...`). Le proxy
   Vercel (`frontend/vercel.json`, `frontend_client/vercel.json`) ne s'applique pas : le
   navigateur va directement sur le domaine Render.
2. `storage:link` est lancé avec `|| true` dans `backend/docker/entrypoint.sh` l. 4 : si le lien
   échoue, personne ne le sait.
3. `render.yaml` déclare `plan: free` **sans disque persistant** : le système de fichiers est
   éphémère, donc les fichiers uploadés disparaissent à chaque redéploiement/redémarrage. C'est
   la cause principale en production (en local, les images s'affichent).

**À faire** (dans cet ordre)
1. **Rendre les preuves servies par l'API** : route authentifiée
   `GET /api/payment-proofs/{proof}/file` (contrôle de périmètre + `Storage::disk('public')->response()`),
   et exposer `file_url` en **URL relative** (`/api/payment-proofs/{id}/file`). Supprime d'un coup
   les problèmes d'URL absolue, de proxy et de mixed content.
2. ~~Rendre le stockage durable~~ — **sans objet** : la production tourne sur o2switch, dont le
   disque est persistant. `render.yaml` (plan gratuit, disque éphémère) n'est plus le lieu de
   déploiement ; le garder à jour ou le supprimer est un autre sujet.
3. Rendre l'échec de `storage:link` visible (retirer `|| true` ou journaliser) — fait dans
   `docker/entrypoint.sh` ; sur o2switch, `setup-storage-link.php` joue ce rôle.
- Tests : `PaymentProofFileTest` — URL signée qui sert le fichier, requête non signée → 403,
  fichier absent → 404.

---

## Lot B — Administration & sessions (points 1 et 2)

### B1 — Point 2 : session de 24 h réglable · M

**Aujourd'hui** — l'API est consommée en **token Bearer Sanctum** stocké dans `localStorage`
(`frontend/src/api/client.ts`), pas en cookie de session. `backend/config/sanctum.php` l. 53 :
`'expiration' => null` → **les tokens n'expirent jamais**. `SESSION_LIFETIME=120` ne concerne que
la session Laravel, sans effet ici.

**À faire**
- Ajouter un réglage `auth.token_lifetime_hours` (défaut **24**) dans
  `SettingController::ALLOWED_KEYS` (l. 15-25) + validation (l. 86-96) et dans l'écran Paramètres.
- Comme `config('sanctum.expiration')` est lu au démarrage et n'est pas modifiable à chaud, faire
  un **middleware** qui compare `personal_access_tokens.created_at` (ou `last_used_at`) à la
  valeur du réglage et renvoie 401 au-delà. Le middleware `EnsureSingleSession`
  (`backend/app/Http/Middleware/EnsureSingleSession.php`, alias `single.session` déclaré dans
  `bootstrap/app.php` l. 33) est l'endroit naturel pour ça : il traite déjà les tokens de
  l'utilisateur à chaque requête.
- Côté front, `client.ts` gère déjà le 401 → déconnexion ; vérifier le message affiché.
- Prévoir `php artisan cache:clear` après modification du réglage (valeur mise en cache).

### B2 — Point 1 : modifier un profil utilisateur depuis l'admin · M

**Aujourd'hui** — seules deux routes existent :
`PUT /api/users/{user}/role` (`UserRoleController`) et `POST /api/users/{user}/reset-password`
(`backend/routes/api.php` l. 461-462). **Aucun** endpoint de mise à jour du profil, donc l'écran
Paramètres → Utilisateurs ne peut rien éditer.

**À faire**
- `UserController::update` : nom, prénom, e-mail, téléphone, agence(s), actif/inactif, rôle
  (via le contrôleur existant). Validation d'unicité de l'e-mail, permission dédiée
  (`utilisateurs.modifier`), journalisation d'activité.
- Côté front : modale d'édition dans la page Utilisateurs des paramètres, rafraîchissement de la
  liste et des listes dérivées (Employés, Commerciaux, Formateurs).
- Ne pas casser `UserController.php` l. 147 (synchronisation des noms vers les fiches
  commercial/formateur) : la réutiliser après l'édition.
- Test : mise à jour autorisée/interdite + propagation du nom dans les annuaires.

---

## Lot C — Académie (point 10)

### C1 — « Nouveau formateur » : lister tous les utilisateurs de l'agence · S

**Aujourd'hui** — `TrainerController::availableUsers` (`backend/app/Http/Controllers/Api/TrainerController.php`
l. 121-143) filtre `whereHas('role', name = 'formateur')` **et** exclut les comptes déjà liés.
`linkUser` (l. 183-207) refuse aussi tout compte dont le rôle n'est pas « formateur ».

**À faire**
- Élargir `availableUsers` à **tous les utilisateurs internes de l'agence** (même logique que
  `candidates`, l. 144-176, déjà utilisée pour les sessions), en excluant les comptes clients.
- Assouplir la validation de `linkUser` en conséquence (ou lier automatiquement le profil
  vendeur si le rôle n'est pas « formateur »).
- Vérifier la contrainte d'unicité `trainers.user_id` (un compte = un seul profil formateur).
- Front : `frontend/src/pages/academy/AcademyTrainersPage.tsx` (l. 212, 323) — aucun changement
  d'interface attendu, la liste s'enrichit toute seule.

---

## Lot D — Suivi des ventes (point 11)

### D1 — Vente d'un produit d'une autre agence invisible pour le commercial · M

**Aujourd'hui** — `SalesTrackingController::index` (`backend/app/Http/Controllers/Api/SalesTrackingController.php`
l. 76-84) applique le périmètre d'agences de l'utilisateur (`ScopeService::agencyIds`) **avant**
le filtre « mes ventes ». Un commercial n'a que son agence dans son périmètre
(`ScopeService.php` l. 78-88) ; une facture émise sur l'agence propriétaire du produit est donc
filtrée, alors que `commercial_id` / `seller_user_id` désignent bien le commercial.

**À faire**
- Pour un commercial (`actsAsCommercial()`), ne **pas** appliquer le filtre d'agence à ses
  propres ventes : `where(seller_user_id = user OR commercial_id = profil)` sans restriction
  d'agence (c'est déjà la logique de `InvoiceController::whereOwnSale`, l. 108-116).
- Vérifier les mêmes filtres dans `CommercialMonthlyReportService`, les KPI du tableau de bord
  commercial et `InvoiceController::index` (l. 67-107) pour rester cohérent.
- Test : facture sur l'agence B vendue par un commercial de l'agence A → présente dans son suivi
  et dans son rapport mensuel.

---

## Lot E — Dépenses & caisses (points 12, 13, 14a, 14b)

### E1 — Point 12 : interdire une dépense supérieure au solde · M

**Aujourd'hui** — aucun contrôle de solde nulle part : `ExpenseService::pay`
(`backend/app/Services/ExpenseService.php` l. 57-101) et
`TreasuryService::recordMovement` / `transfer` (`backend/app/Services/TreasuryService.php`
l. 27-29, 67-72) laissent le solde devenir négatif. Les tests l'assument explicitement
(`TreasuryControlsTest.php` l. 146, 152, 212 ; `TreasuryCashClosingTest.php` l. 194) — ils devront
être adaptés.

**À faire**
- Contrôle dans `TreasuryService::recordMovement` pour toute sortie (avec un drapeau
  `allowNegative` pour les corrections/contre-passations internes) :
  `422` avec le message **« Solde insuffisant dans cette caisse. »** et les montants
  (solde disponible / montant demandé).
- Contrôle en amont dans `ExpenseService::pay` pour un message métier clair, et dans
  `transfer` pour les virements entre caisses.
- Mettre à jour les tests cités + ajouter un test « dépense > solde → 422, solde inchangé ».
- Décision à prendre : appliquer à **toutes** les sorties ou **aux dépenses seulement**.

### E2 — Point 13 : modifier et annuler une dépense · L

**Aujourd'hui** — `ExpenseController::update` (`backend/app/Http/Controllers/Api/ExpenseController.php`
l. 327-351) n'autorise la modification qu'au statut `draft` ; `destroy` (l. 513-521) est une
suppression douce. **Aucune action « annuler »** n'existe. Les colonnes
`expenses.cancelled_by` / `cancelled_at` existent déjà mais ne sont pas utilisées. Aucune modale
dédiée côté front : tout est inline dans `frontend/src/pages/expenses/ExpenseListPage.tsx`.

**À faire**
1. **Modifier** : autoriser l'édition tant que la dépense n'est pas payée (`draft`, `rejected`,
   éventuellement `submitted` → repasse en brouillon), avec recalcul des écritures comptables.
2. **Annuler** : nouvel endpoint `POST /expenses/{expense}/cancel` + statut `cancelled` (ou
   réutilisation de `cancelled_at` avec `STATUS_CANCELLED` à ajouter dans
   `Expense::STATUSES`). Motif obligatoire, journalisation.
   - Dépense **payée** : contre-passer le mouvement de trésorerie (`TreasuryService`) et
     l'écriture comptable (`writeExpenseAccounting`) avant de marquer annulée.
   - Dépense non payée : simple changement de statut.
3. Front : boutons « Modifier » / « Annuler » dans la liste, modale d'édition et de motif
   (le fichier fait déjà ~590 lignes : extraire un composant `ExpenseFormModal` /
   `CancelExpenseModal` à cette occasion).
4. Tests : transitions autorisées/interdites, contre-passation, solde de caisse rétabli.

### E3 — Point 14a : clôturer / rouvrir toutes les caisses · M

**Aujourd'hui** — tout est strictement individuel : `CashClosingController` (l. 18-136) et
`CashClosingService::close` / `reopen` (l. 138-190). Aucune route ni méthode groupée.

**À faire**
- `POST /cash-closings/close-all` et `POST /cash-closings/reopen-all`, avec filtre d'agence et
  périmètre utilisateur ; réponse détaillée (caisses fermées / déjà fermées / en erreur).
- Service : boucler sur `assertAgencyOpen` + `close()` / `reopen()` en transaction par caisse
  (une erreur ne doit pas bloquer les autres).
- `close()` / `reopen()` typent `User` alors que `closed_by` / `reopened_by` sont nullables :
  rendre le paramètre nullable (utile aussi pour E4).
- Front : `frontend/src/pages/treasury/CashClosingsPage.tsx` (boutons globaux l. 95-141, cartes
  l. 209-247) + confirmation avant action groupée.

### E4 — Point 14b : fermeture auto 22 h / ouverture auto 7 h, réglables · L

**Aujourd'hui** — aucune tâche planifiée pour les caisses : `backend/routes/console.php` l. 12-22
n'en contient aucune, et `SettingController::ALLOWED_KEYS` (l. 15-25) n'a pas d'horaires de
caisse.

**À faire**
1. Réglages `cash_closing.auto_close_time` (défaut `22:00`) et `cash_closing.auto_open_time`
   (défaut `07:00`), par agence **ou** globaux — à trancher (voir décisions).
2. Deux commandes Artisan (`cash:close-day`, `cash:open-day`) dans
   `backend/app/Console/Commands/` (auto-découvertes), idempotentes, avec `--date` pour rejouer.
3. Planification via `Schedule::command(...)->hourly()` + test de l'heure locale : l'application
   est en **UTC** (`backend/config/app.php` l. 72), le métier en `Africa/Douala` (l. 87) et les
   pays XOF en `Africa/Abidjan` (`backend/app/Support/Period.php` l. 24-27) — **une heure fixe
   unique est fausse pour les deux zones**. Calculer l'heure de chaque agence depuis son pays.
4. Écran Paramètres : champs horaires + mention du fuseau utilisé.
5. Tests : rejouer le cron comme `ScheduledLifecycleTest.php` (jour par jour), vérifier qu'une
   caisse déjà fermée n'est pas refermée, et que la réouverture ne touche pas une caisse déjà
   ouverte.

---

## Décisions à prendre avant de coder

1. ~~**Stockage des preuves (point 3)**~~ : réglé — production o2switch, disque persistant ; les
   fichiers sont servis par l'API, indépendamment de `/storage`.
2. ~~**Session 24 h (point 2)**~~ : réglage global `session_lifetime_minutes` (défaut 24 h,
   12 h pour la direction), modifiable par le super-admin depuis les Paramètres.
3. **Solde insuffisant (point 12)** : contrôle sur toutes les sorties de trésorerie ou seulement
   sur les dépenses ? (proposition : toutes les sorties, avec un drapeau interne pour les
   contre-passations).
4. **Horaires de caisse (point 14b)** : un seul couple d'horaires pour tout le groupe, ou un
   réglage par agence ? (proposition : par agence, avec une valeur par défaut globale).
5. **Statut « annulée » des dépenses (point 13)** : nouveau statut `cancelled` visible dans les
   filtres/rapports, ou simple `deleted_at` avec un motif ?

---

## Vérifications à lancer avant livraison

```bash
docker exec pekegno-server php artisan test
```

Puis la suite sur PostgreSQL (procédure `CLAUDE.md`, base jetable) — indispensable dès que le lot E
ajoute un statut (contrainte `CHECK` sur `expenses.status`) ou modifie une colonne.

Rappel : ~31 échecs connus liés à l'absence de l'extension `gd` en local. Vérifier que **leur
liste ne change pas** ; ne pas les corriger dans le cadre de cette tâche.

Après toute migration sur un serveur : `php artisan cache:clear` (listes de référence mises en
cache jusqu'à 1 h).
