# Guide de test — Département Pekegno Agency

Pour le collègue qui reprend : comment **préparer**, **tester à la main** et **lancer les tests automatiques** du département Agency.
À lire avec `doc/AGENCY_A_FAIRE.md` (règles métier D1 → D20) et `doc/audit.md` (ce qui a été codé).

> ✅ Les 12 migrations Agency **ont été lancées sur la base locale de Mike** le 2026-10-03. Sur une autre base (la tienne, la préprod), lance-les toi-même (§1, étape 1) et préviens l'équipe avant de toucher une base partagée.

---

## 1. Préparation (≈ 5 min)

Le backend tourne dans le conteneur `pekegno-server` (PHP 8.3, le dossier `backend/` est monté sur `/app`).

```bash
# 1. Schéma Agency (12 migrations 2026_10_03_*) — déjà fait sur la base locale de Mike
docker exec -it pekegno-server php artisan migrate:status | grep 2026_10_03   # « Ran » partout = OK
docker exec -it pekegno-server php artisan migrate

# 2. (Recommandé) Packages du flyer + rôles d'équipe par défaut, pour chaque département de type Agency
docker exec -it pekegno-server php artisan db:seed --class=AgencyPackageSeeder

# 3. Vider le cache de config si besoin
docker exec -it pekegno-server php artisan config:clear

# 4. Frontends
cd frontend && npm run dev                       # back-office  → http://localhost:5173
cd frontend_client && npm ci && npm run dev      # portail client → http://localhost:5174
```

Pour voir les e-mails de rappel sans vrai SMTP : mettre `MAIL_MAILER=log` dans `backend/.env` (les e-mails apparaissent dans `backend/storage/logs/laravel.log`).

### 1.1 Comptes de démo (mot de passe : `password`)

| Rôle | E-mail | Utilisation dans les tests |
|---|---|---|
| super-admin | `admin@pekegno.com` | tout |
| direction-generale | `jean.mbarga@pekegno.com` | valider une prestation |
| responsable-agence (chef d'agence Douala) | `paul.ekotto@pekegno.com` | valider, reçoit les alertes de renouvellement |
| responsable-agence (Yaoundé) | `sophie.adje@pekegno.com` | test « hors périmètre » sur Douala (403) |
| commercial (Douala) | `fatima.bello@pekegno.com` | crée prestations / souscriptions, ne voit que les siennes |
| caissier | `youssef.hamid@pekegno.com` | encaisse les factures |
| responsable-departement | `grace.tala@pekegno.com` | gère, mais **ne valide pas** |

**À créer soi-même** (menu Utilisateurs, en admin) :
- un **community manager** : rôle `community-manager` (créé par la migration 000011), rattaché à l'agence de Douala ;
- un **client** : depuis le portail (`/inscription`) ou depuis Clients dans le back-office. Il faut pouvoir se connecter au portail avec ce compte.

### 1.2 Où se trouve l'Agency

Agences ▸ *Agence Principale Douala* ▸ Départements ▸ carte **Agency Douala**. La carte affiche maintenant un badge **Agency**.
URL de base : `http://localhost:5173/departments/<id-du-département>`.

**Menu attendu** : Tableau de bord · Prospects · Clients · Packages · Prestations (onglets **Liste** / **Suivi des prestations**) · Équipe client · Contrats (onglets **Tous / Packages souscrits / Prestations / Manuels**) · Produits · Community Management · Publicité · Renouvellements · Factures · Créances · Comptabilité · Bilan du jour · Rapports · Paramètres.
✅ **Academy**, **Commissions** et **Suivi des prestations** ne sont **pas** dans le menu : les commissions sont dans **Paramètres**, le suivi est un onglet de **Prestations**.

---

## 2. Recette manuelle — scénarios

Cocher au fur et à mesure. **Attendu** = ce qui doit se passer ; en cas d'écart, noter le scénario et la capture dans le rapport (§13 de `AGENCY_A_FAIRE.md`).

### S1 — Paramètres Agency (D2, D8, D19)
Compte : admin. Département Agency ▸ **Paramètres**.
1. Bloc « Commissions » en haut de la section Agency ⇒ il ouvre la page Commissions.
2. Délais d'alerte : la valeur affichée est `30, 15, 7, 1`. Saisir `45, 3` puis Enregistrer ⇒ recharger ⇒ `45, 3`. **Remettre `30, 15, 7, 1`.**
3. Ajouter une catégorie de package « Test » et une catégorie de prestation « Réseaux sociaux » ⇒ elles s'affichent en pastilles.
4. Cliquer « Rôles par défaut » ⇒ Community manager, Account manager, Graphiste, Vidéaste, Media buyer, Commercial, Coach.

### S2 — Packages, promotion (cahier + réunion)
Compte : admin. **Packages**.
1. Après le seeder : 2 groupes (« Packages stratégiques mensuels », « Services à la carte »). Starter affiche ~~370 000~~ **299 000 / mois**, ses 4 éléments et « 01 COMMUNITY MANAGER · 02 COMMERCIAL ».
2. « Nouveau package » : nom, accroche, catégorie, prérequis, prix 100 000, prix barré 150 000, 2 éléments, 1 recommandation ⇒ la carte apparaît.
3. Icône % ▸ promotion **10 %** du jour à J+10 ⇒ la carte affiche « Promotion en cours », ~~100 000~~ **90 000**.
4. Modifier le package ⇒ les changements sont visibles. Supprimer un package **sans** contrat ⇒ il disparaît. Avec un contrat ⇒ message « désactivé ».

### S3 — Souscription à plusieurs packages (D1, D3)
Compte : admin (puis refaire avec le commercial Fatima).
1. Starter ▸ « Souscrire un client » : client, commercial, début aujourd'hui, **3 périodes**, sans avance ⇒ redirection vers la **prestation créée**.
2. Attendu sur la prestation : statut **Validée**, une action par élément du package (onglet Actions), budget = 897 000 (3 × 299 000), contrat lié en **« En attente du 1er paiement »**.
3. Même client ▸ souscrire un second package (ex. Shooting, 1 période).
4. **Contrats** ▸ onglet **Packages souscrits** ⇒ 2 lignes pour ce client (2 contrats distincts). Il n'y a plus de menu « Souscriptions » : une souscription EST un contrat. L'ancienne URL `…/subscriptions` redirige vers cet onglet.
5. Souscrire un compte **non client** (ex. le caissier) ⇒ erreur « Le client lié doit avoir le rôle client ».

### S4 — Prestation créée à la main + validation (D9)
1. Compte : commercial Fatima. **Prestations** ▸ Nouvelle : catégorie, nom « Lancement réseaux », client, période 1 mois, budget **500 000**, commission **10 %** ⇒ statut **Brouillon** ; le commercial est elle-même.
2. Toujours Fatima : bouton « Soumettre à validation » ⇒ **En attente de validation**. Le bouton « Valider » **n'apparaît pas** pour elle.
3. Compte : **sophie.adje** (chef d'agence de Yaoundé) ▸ ouvrir l'URL de la prestation ⇒ **403 / erreur de périmètre**.
4. Compte : **paul.ekotto** (chef d'agence de Douala) ▸ « Valider » ⇒ statut **Validée** ; onglet Résumé ⇒ contrat **CTR-xxxxx** « En attente du 1er paiement » ; onglet Factures ⇒ 1 facture de 500 000.
5. Variante : « Rejeter » sans motif ⇒ impossible. Avec motif ⇒ statut Rejeté et motif affiché.

### S5 — Actions et budget (D4)
Sur la prestation de S4 (budget 500 000), onglet **Actions**, compte admin :
1. Action « 3 vidéos Facebook par semaine » : type Community management, quantité 3, unité vidéo, fréquence par semaine, budget **150 000**, assignée au community manager, échéance dans 7 jours.
2. Action « Publicité Facebook » : type Publicité, budget **300 000**, case **« Budget publicitaire du client »** cochée.
3. Action « Shooting » budget **100 000** ⇒ **refus** « Budget restant insuffisant : 50 000 FCFA ».
4. La barre de budget affiche : alloué 450 000, restant 50 000.
5. Icône 💬 (suivi) : ajouter un commentaire ; enregistrer une réalisation (quantité 1, lien de preuve, coût 20 000) ⇒ progression mise à jour ; l'action passe **En cours** ; le coût réel s'affiche.
6. Changer le statut d'une action dans la liste déroulante ⇒ enregistré.
7. Modifier le budget de la prestation (bouton Modifier) ⇒ **champ désactivé** (budget figé par le contrat).

### S6 — Premier paiement ⇒ contrat actif (D10)
1. Contrat de S4 ▸ « Déposer le PDF signé » (n'importe quel PDF) ⇒ « PDF signé : jj/mm/aaaa », contrat **toujours en attente**.
2. Compte caissier : Factures (menu Agency) ⇒ facture du contrat ⇒ encaisser **100 000** en cash.
3. Retour sur le contrat ⇒ **Actif**, « Activé le » renseigné. La prestation passe **En cours**.
4. La facture de S4 a **2 lignes** : honoraires 200 000 + « Budget publicitaire client » 300 000 (pass-through).

### S7 — Commissions (D6, D13, D17)
Compte : admin. **Paramètres ▸ Commissions**.
1. Section « Commissions calculées » : pour le paiement de S6 ⇒ commission « Prestation (taux saisi) ». Base = part des honoraires du paiement (100 000 × 200 000 / 500 000 = 40 000), montant **4 000** (10 %).
2. « Nouvelle règle par package » : Starter, 5 % ⇒ elle apparaît dans « Règles par package ».
3. Encaisser une partie de la facture de souscription Starter (S3) ⇒ une commission « Package » de 5 % du montant encaissé. Un second encaissement ⇒ une **seconde** ligne (une par paiement).
4. Valider puis payer une commission ⇒ statuts Validée puis Payée.

### S8 — Bilan du jour et comptabilité du département (D7, D15, D20)
1. **Bilan du jour** (date du jour) : lignes « Agency · <catégorie> · prestation / package » avec les **honoraires** ; ligne grisée « Budget pub client encaissé (hors CA) » ; le **Total ventes n'inclut pas** le budget pub, le **Total encaissé** l'inclut.
2. Comparer avec le bilan de l'**agence** (Agences ▸ Douala ▸ Bilan) : il inclut aussi les autres départements (Academy…). Le bilan du **département** ne montre que l'Agency.
3. **Comptabilité** du département : seules les écritures de l'Agency (encaissements de ses contrats, dépenses rattachées à ce département). Ajouter une écriture manuelle ici ⇒ elle reste visible ici, et pas dans la compta du département Academy.
4. Export CSV du bilan ⇒ contient les lignes Agency.

### S9 — Notation par le client (D5, D11, D12) — portail client
Compte : **le client** de S4, sur `http://localhost:5174` ▸ Mon compte ▸ **Mes prestations**.
1. La prestation de S4 (En cours) apparaît ; la déplier ⇒ la liste des actions avec des étoiles cliquables.
2. Noter l'action 1 ⇒ **5★**, l'action 2 ⇒ **3★** ⇒ « 4.0 · 2 avis ».
3. Modifier l'action 2 en **4★** ⇒ toujours **2 avis**, moyenne **4.5** (une seule note par action, modifiable).
4. Une prestation seulement **Validée** (pas encore payée, ex. Shooting de S3) ⇒ message « Vous pourrez noter les actions dès que la prestation aura démarré », étoiles inactives.
5. Back-office, prestation de S4 ▸ onglet **Notes** : bloc Play Store (4.5, barres 5→1), notes par action, **aucun bouton « Noter »** côté staff.

### S10 — Grand tableau « Suivi des prestations »
Compte : admin ▸ **Prestations** ▸ onglet **Suivi des prestations** (le menu « Prestations » reste actif).
1. Colonnes **Prestations · Notes · Statut · Motif**. La prestation de S4 affiche ses étoiles (4.5).
2. Menu « Changer… » ▸ Suspendre ⇒ fenêtre **motif obligatoire** ⇒ « Retard de paiement » ⇒ statut **Suspendue**, colonne Motif renseignée ; le contrat lié passe **Suspendu**.
3. « Reprendre » ⇒ En cours ; le contrat redevient Actif.
4. Filtres (statut, note ≥ 4, dates), tri par Notes / Statut, bouton **Exporter** (CSV).

### S11 — Équipe client
1. Prestation de S4 ▸ onglet **Équipe** : ajouter le community manager (rôle « Community manager », Responsable) et Fatima (rôle « Commercial »).
2. Menu **Équipe client** ⇒ une carte par personne : rôles Agency, prestations / clients, nombre d'actions ouvertes ; filtre par rôle.

### S12 — Périmètre par rôle
1. Compte **community manager** ⇒ **Prestations** n'affiche **que** la prestation de S4. Il peut changer le statut et le coût des actions, mais pas leur budget ni leur titre.
2. Compte **commercial Fatima** ⇒ ne voit que **ses** prestations ; l'URL d'une prestation d'un autre commercial ⇒ 403.
3. Compte **grace.tala** (responsable-departement) ⇒ peut modifier, **ne voit pas** « Valider ».

### S13 — Community Management / Publicité
1. **Community Management** ⇒ les actions « community management » et « production de contenu » de toutes les prestations ; case « Seulement en retard ».
2. **Publicité** ⇒ les actions publicitaires, avec les totaux alloué / dépensé / **budget pub client**.

### S14 — Renouvellements et alertes (D8, D14, D18)
Préparer un contrat qui finit bientôt : créer une prestation avec une **fin dans 10 jours**, la valider, puis l'encaisser (pour qu'elle soit Active).
```bash
docker exec -it pekegno-server php artisan agency:check-renewals
```
Attendu :
1. Le contrat passe **À renouveler** et apparaît dans **Renouvellements** (« dans 10 j »).
2. Le **chef d'agence** (paul.ekotto) a une notification « Renouvellement J-15 » (`GET /api/agency-notifications`) et une **tâche CRM** « Relancer le renouvellement… » (Activités).
3. Le **client** voit la notification sur le portail (cloche avec compteur, page Notifications) et reçoit l'**e-mail** (ou la ligne dans `laravel.log` si `MAIL_MAILER=log`).
4. Le **commercial ne reçoit rien**.
5. Relancer la commande ⇒ **pas de doublon** (même seuil).
6. **Renouveler** depuis Renouvellements ou la fiche contrat ⇒ nouveau contrat **En attente** + **nouvelle facture** ; l'ancien contrat passe **Renouvelé** ; pour un package, une **nouvelle prestation** est créée. Encaisser la nouvelle facture ⇒ le nouveau contrat passe **Actif**.
7. Résilier un contrat (motif obligatoire) ⇒ Résilié, prestation liée Annulée.

Actions en retard : une action dont l'échéance est passée et qui n'est pas terminée ⇒ après la commande, une notification « Action en retard » pour l'assigné et le responsable de la prestation (une seule fois).

### S15 — Contrat PDF, fiche client, rapports, tableau de bord
1. Fiche contrat ▸ **PDF** ⇒ téléchargement : Pekegno / client / prestation, période, montant, contenu, signatures.
2. Clients ▸ fiche d'un client ▸ onglet **Agency** ⇒ packages souscrits, prestations, contrats.
3. **Rapports** : choisir la période ⇒ CA (hors pass-through), encaissé, budget pub, créances, MRR, taux de renouvellement, répartitions ; bouton **CSV**.
4. **Tableau de bord** : les mêmes KPI sur le mois en cours, satisfaction, tops ; les cartes sont cliquables.

### S16 — Reprise des abonnements (D1, D16) — sur une copie de la base uniquement
```bash
docker exec -it pekegno-server php artisan agency:migrate-subscriptions --dry-run   # simulation, n'écrit rien
docker exec -it pekegno-server php artisan agency:migrate-subscriptions             # demande confirmation
docker exec -it pekegno-server php artisan agency:migrate-subscriptions             # 2e passage : « Repris : 0 »
```
Attendu : un contrat `origin=package` par abonnement ; les statuts sont repris (annulé ⇒ Résilié, renouvelé ⇒ Renouvelé, actif dont la date est passée ⇒ Expiré) ; la facture est liée au contrat.
Ensuite `AGENCY_SUBSCRIPTIONS_READ_ONLY=true` dans `.env` puis `php artisan config:clear` ⇒ `POST /api/subscriptions` répond **409**.

---

## 3. Tests automatiques

```bash
# Tests Agency uniquement (25 tests, ~3 s) — base SQLite en mémoire, ne touche pas Postgres
docker exec pekegno-server php artisan test --filter=AgencyDepartmentTest

# Toute la suite
docker exec pekegno-server php artisan test
```
Résultat attendu de la suite complète : **407 OK, 21 KO**. Les 21 échecs existaient avant ce travail : ils viennent tous de « GD extension is not installed » (conteneur sans extension GD). Pour les faire passer, installer `php-gd` dans l'image.

| Test | Règle vérifiée |
|---|---|
| `test_package_has_items_recommendations_and_effective_price_with_promotion` | contenu, recommandations, promo −10 % |
| `test_subscribing_to_two_packages_creates_two_contracts_and_prefilled_prestations` | D1, D3 |
| `test_subscription_requires_client_role` | contrôle du client |
| `test_validating_a_prestation_creates_a_pending_contract_with_allocated_budget` | validation ⇒ contrat + facture |
| `test_first_payment_activates_contract_and_starts_prestation` | D10 |
| `test_signed_pdf_alone_does_not_activate_contract` | D10 |
| `test_commercial_cannot_validate_and_chief_outside_scope_is_forbidden` | D9 + périmètre |
| `test_forbidden_transition_and_missing_reason_are_rejected` | workflow + motif + contrat suspendu |
| `test_action_budget_is_strictly_capped_by_prestation_budget` | D4 |
| `test_client_rates_each_action_once_and_can_modify_it` | D5, D11 |
| `test_only_the_prestation_client_can_rate_and_only_when_in_progress_or_completed` | D5, D12 |
| `test_prestation_outside_package_uses_its_own_commission_rate_on_payment` | D17 |
| `test_package_commission_rule_applies_on_each_payment` | D6, D13 |
| `test_daily_bilan_excludes_client_ad_budget_from_revenue` | D7, D15 |
| `test_renewal_alerts_go_to_agency_chief_and_client_once_per_threshold` | D8, D14, D18 |
| `test_renewal_alert_days_are_configurable_per_department` | D8 |
| `test_subscription_history_migration_is_complete_and_idempotent` | D16 |
| `test_subscriptions_become_read_only_when_switch_is_enabled` | D1 |
| `test_commercial_and_community_manager_only_see_their_prestations` | périmètre |
| `test_tracking_table_exposes_name_rating_status_and_reason` | grand tableau |
| `test_overdue_action_notifies_assignee_once` | actions en retard |
| `test_agency_report_returns_kpis` | rapports |
| `test_contract_pdf_is_downloadable` | PDF |
| `test_bilan_and_accounting_are_scoped_to_the_department` | D20 |
| `test_renewing_an_agency_contract_creates_invoice_and_can_be_activated` | renouvellement |

Vérifications frontend :
```bash
cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm run build
cd frontend_client && npm ci && npm run build
```

---

## 4. Tester l'API directement (optionnel)

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/staff/login -H 'Accept: application/json' \
  -d email=admin@pekegno.com -d password=password | jq -r .token)
H="Authorization: Bearer $TOKEN"

curl -s -H "$H" -H 'Accept: application/json' "http://localhost:8000/api/packages?department_id=<DEPT>" | jq '.data[].name'
curl -s -H "$H" -H 'Accept: application/json' "http://localhost:8000/api/prestations/tracking?department_id=<DEPT>" | jq '.data'
curl -s -H "$H" -H 'Accept: application/json' "http://localhost:8000/api/reports/agency?department_id=<DEPT>" | jq '.kpis'
curl -s -H "$H" -H 'Accept: application/json' "http://localhost:8000/api/bilans?department_id=<DEPT>" | jq '{total_received, agency_total, agency_pass_through_total}'
```
Si la connexion renvoie un défi 2FA, désactiver la 2FA du compte de test ou utiliser un autre compte. Toutes les routes Agency sont listées dans `backend/routes/api.php` (blocs « === Agency »).

---

## 5. En cas de problème

| Symptôme | Cause probable / solution |
|---|---|
| Pages Agency en erreur 500, « relation … does not exist » | migrations non lancées ⇒ `php artisan migrate` |
| 403 partout sur l'Agency avec un rôle autre qu'admin | permissions non créées ⇒ vérifier que la migration `2026_10_03_000011` est passée |
| Aucun package après le seeder | aucun département de type `agency`, ou seeder lancé avant la migration |
| Le client ne peut pas noter | prestation pas encore **En cours** (il faut un 1er paiement) ou action annulée |
| Le contrat reste « En attente » | aucun paiement **validé** sur sa facture |
| Pas d'alerte de renouvellement | contrat non Actif / À renouveler, ou échéance au-delà du plus grand délai, ou commande `agency:check-renewals` non lancée |
| Pas d'e-mail | `MAIL_MAILER` : utiliser `log` en local |
| La comptabilité du département est vide alors que l'agence a des écritures | normal (D20) : seules les écritures rattachées au département s'y affichent |

Une fois la recette faite, noter le résultat dans le **journal des rapports** (§13 de `AGENCY_A_FAIRE.md`).
