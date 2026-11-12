# Décisions client T0.3 → T0.6 (+ matrice caissier)

> **Objet** : recueillir les 4 décisions du Lot 0 qui bloquent encore du code, et valider la
> matrice des droits du rôle Caissier (Lot 9).
> **Référence** : `doc/PLAN_TRAVAIL_CORRECTIONS_WORLDEV_V1.md` (§3 Lot 0, §7 B25, §12 Lot 9).
> **Date** : 12 novembre 2026.
> **Statut** : propositions prêtes — **à valider par la Direction Pekegno**.
> **Règle** : une décision = une case cochée. Tant qu'une décision n'est pas cochée, la tâche
> concernée reste bloquée ; les autres avancent normalement.

---

## 0. Comment répondre

Pour chaque point, cocher **A**, **B** ou **C** (ou écrire la variante). Chaque option indique
ce qui change concrètement dans la plateforme et la charge de travail associée.

| # | Décision | Question en une ligne | Bloque |
|---|---|---|---|
| T0.3 | Caisses Côte d'Ivoire | Quelles caisses pour Abidjan ? | Lot 3 (administration par pays) |
| T0.4 | Mapping des rubriques | Quel article va dans quelle rubrique ? | Rapports par rubrique (Bilan, Comptabilité) |
| T0.5 | Règle « Date échue » | Automatique ou motif saisi par la caissière ? | **B25**, dernier bug P2 |
| T0.6 | Périmètre Community Manager | Vendeur ou exécutant de prestations ? | Scénario de recette §14.3 |
| §12 | Matrice caissier | Peut-on retirer la comptabilité complète ? | Fin du Lot 9 |

**Recommandation générale** : T0.3-A, T0.4-A, T0.5-C, T0.6-A, matrice caissier telle que proposée
au §6. Cette combinaison débloque 100 % du Lot 5 et l'essentiel des Lots 3, 7 (recette) et 9.

---

## 1. Synthèse : ce que chaque décision débloque

| Décision | Débloque | Charge si option recommandée |
|---|---|---|
| T0.3 | Création des caisses d'Abidjan, ventilation Wave/Moov, Lot 3 | **0,5 j** (configuration, aucun code) |
| T0.4 | Colonnes « Recettes par rubrique » réelles au Bilan et en Comptabilité | **1 j** (configuration catalogue) |
| T0.5 | B25 + traçabilité des rejets de preuve | **0,5 à 1 j** (option C : 2 à 3 j) |
| T0.6 | Permissions, menus et scénario de recette du Community Manager | **1 à 2 j** |
| Matrice caissier | Clôture du Lot 9 (hors réactivation 2FA) | **1 j** |

Total : **4 à 5,5 jours** pour fermer le Lot 0 et le Lot 5.

---

## 2. T0.3 — Caisses de Côte d'Ivoire

### 2.1 Ce que le code fait déjà (vérifié)

Les caisses sont codifiées et créées automatiquement par `TreasuryAccountProvisioner` :

| Code | Libellé par défaut | Type | Créée pour |
|---|---|---|---|
| `C` | Caisse Principale | espèces | toutes les agences |
| `O` | Orange Money | mobile money (`orange_money`) | toutes les agences |
| `M` | MTN MoMo | mobile money (`mtn_momo`) | toutes les agences |
| `B` | Compte bancaire | banque | toutes les agences |
| `W` | Wave | mobile money (`wave`) | agences en **XOF** uniquement |
| `V` | Moov Money | mobile money (`moov_money`) | agences en **XOF** uniquement |

- Un paiement est automatiquement routé vers la caisse de son mode (`wave` → `W`, `om` → `O`…).
- Les caisses `O`, `M`, `B`, `W`, `V` ne sont visibles que du super-admin, de la DG et du comptable ;
  la caissière reçoit un **403 côté serveur** (déjà vérifié en recette I2).
- **État réel de la base locale** : Abidjan possède aujourd'hui `C` et `O` seulement.
  `M`, `B`, `W` et `V` ne sont pas encore créées (le seeder n'a pas été rejoué sur cette agence).

### 2.2 Question à Pekegno

> **Quelles caisses existent réellement à Abidjan (Cocody Riviera Bonoumin) ?**

| Option | Contenu | Conséquence |
|---|---|---|
| **A — recommandée** | `C` espèces, `O` Orange Money, `M` MTN MoMo, `W` Wave, `V` Moov, `B` compte bancaire | 6 caisses, aucune saisie modifiée pour les autres agences |
| **B** | `C`, `O`, `W`, `B` seulement (pas de MTN ni Moov en Côte d'Ivoire) | 4 caisses, `M` et `V` non créées pour Abidjan |
| **C** | Liste libre fournie par Pekegno | à décrire : libellé + type + opérateur |

**Précisions demandées** :
1. Libellé exact : « Moov Money » ou « Moov Africa » ?
2. Le compte bancaire `B` est-il utilisé à Abidjan (versement d'espèces) ?
3. Les caisses `W` / `V` doivent-elles aussi exister à Douala et Yaoundé (XAF) ?
   *Aujourd'hui elles ne sont créées qu'en XOF.*

### 2.3 Ce que je fais à réception

1. Rejouer `TreasuryAccountSeeder` sur l'agence d'Abidjan (crée les caisses manquantes).
2. Vérifier qu'un encaissement Wave crée bien un mouvement sur `W` (et non sur `C`).
3. Contrôler l'écran « Caisses du jour » : une ligne par caisse, soldes séparés.
4. Aucun changement de code si l'option A ou B est retenue.

---

## 3. T0.4 — Mapping des rubriques de vente

### 3.1 Règle déjà tranchée (9/11/2026)

La règle est **implémentée** dans `App\Support\SaleBranch` :

| Rubrique | Règle |
|---|---|
| **Academy** | toute ligne d'une facture d'inscription à une formation |
| **Agency** | packages et prestations |
| **Séminaire** | tout service coché « Service séminaire (Pass) », quelle que soit sa catégorie |
| **Budget pub client** | ligne *pass-through* : exclue du CA et des dépenses, seuls les honoraires comptent |
| **Toute autre rubrique** | **la catégorie de l'article** (créer une catégorie crée une rubrique) |

Il n'y a donc **plus de développement à faire** : il reste à **nommer les catégories** du catalogue.

### 3.2 Ce que contient la base aujourd'hui (vérifié)

- **1 seule catégorie** : « Store ».
- **14 services** (5 libellés différents, un par agence), **tous** rattachés à « Store ».
- **0 produit** en catalogue.

Conséquence : toutes les ventes de catalogue s'agrègent aujourd'hui dans une seule rubrique
« Store ». Les 7 rubriques du cahier des charges ne sont donc pas visibles au Bilan.

### 3.3 Mapping proposé

| Article du catalogue | Catégorie proposée (= rubrique) | Remarque |
|---|---|---|
| Canva Pro (10 000) | **Canva** | à créer |
| Livre « Comment Gagner de l'Argent en Ligne en Afrique » (24 900) | **Livre** | à créer |
| Bootcamp 3 jours, Yaoundé (50 000) | **Séminaire** | déjà forcé par « Service séminaire (Pass) » |
| Tik Tok Monetise (10 000) | **?** | *à préciser* |
| Logo ou Identité de marque (25 000) | **?** | *Graphisme ? Store ?* |
| Matootoo | — | **absent du catalogue** : à créer si la rubrique est utilisée |
| (produits) | — | aucun produit en base |

| Option | Contenu | Conséquence |
|---|---|---|
| **A — recommandée** | Créer les catégories **Canva**, **Livre**, **Matootoo**, **Graphisme** et rattacher les articles | Bilan et Comptabilité affichent une colonne par rubrique |
| **B** | Garder « Store » pour tout | Les rubriques restent Academy / Agency / Séminaire / Store |

**Question** : pour *Tik Tok Monetise* et *Logo ou Identité de marque*, quelle rubrique ?
Faut-il une rubrique **Matootoo** (aucun article aujourd'hui) ?

### 3.4 Ce que je fais à réception

1. Créer les catégories depuis l'écran existant (« Créer une catégorie »).
2. Rattacher chaque service à sa catégorie (mise à jour de service).
3. Contrôler que `Σ catégories = CA` au Bilan et dans « Recettes par rubrique ».
4. Ajouter un test de non-régression sur le mapping retenu.

---

## 4. T0.5 — Règle « Date échue » → bug B25

### 4.1 État actuel (vérifié)

- Rejeter une preuve de paiement demande un **texte libre** (`notes`) ; il n'existe **aucune liste
  de motifs** et aucune valeur « Date échue » dans le code.
- Une facture **n'a pas de date d'échéance**, et une preuve non plus : il n'existe aujourd'hui
  aucun champ permettant de calculer automatiquement un retard.
- Le motif est bien journalisé (« Preuve de paiement rejetée : … ») et la facture passe en
  `rejected` avec notifiation au commercial.

### 4.2 Options

| Option | Contenu | Charge | Dépend d'une règle métier ? |
|---|---|---|---|
| **A — motif dans une liste** | Liste déroulante de motifs : *Date échue*, *Montant erroné*, *Preuve illisible*, *Mauvais destinataire*, *Autre* — « Autre » ouvre le texte libre. Le motif choisi est journalisé. | 0,5–1 j | Non |
| **B — badge automatique** | Badge « Date échue » calculé sur une échéance dépassée, avec explication et journalisation. | 2–3 j | **Oui** : quelle échéance ? |
| **C — recommandée** | A maintenant, B dès que la règle d'échéance est fixée | 0,5–1 j puis 2–3 j | Non pour A |

### 4.3 Question à Pekegno

> **« Date échue » : la caissière le choisit-elle, ou la plateforme le détecte-t-elle ?**

Si **automatique**, préciser l'échéance applicable :
1. date de la facture + **N jours** → quel N ?
2. date de **début de la formation** (Academy) ?
3. date de la **prestation** (Agency) ?
4. autre règle ?

### 4.4 Ce que je fais à réception

- Option A/C : liste de motifs + journal + affichage du motif sur la facture et la preuve + test
  `PaymentProofRejectionReasonTest`. **B25 passe à « fait »** et le Lot 5 est complet.
- Option B : ajout du champ d'échéance, du badge et du calcul, puis test dédié.

---

## 5. T0.6 — Périmètre du Community Manager

### 5.1 État actuel (vérifié)

La fiche du rôle dit : *« Exécute les prestations Agency auxquelles il est affecté »*.
Or le rôle possède **52 permissions**, soit quasiment les 51 du commercial, plus la modification
des actions de prestation :

- prospects : consultation, création, modification, **suppression** ;
- clients : consultation, création, modification, **suppression** ;
- factures : consultation, **création**, impression, **annulation** ;
- commandes, contrats, entreprises, opportunités, activités, présences ;
- prestations : consultation, **création** ; actions : consultation, création, **modification**.

Autrement dit, aujourd'hui un Community Manager peut vendre, créer des clients et annuler des
factures — ce qui dépasse la description de son rôle.

### 5.2 Options

| Option | Contenu | Charge |
|---|---|---|
| **A — recommandée** | **Exécutant de prestations** : voit les prestations/actions qui lui sont assignées, met à jour leur statut, ajoute preuve et note. Lecture seule sur les clients concernés. **Aucune vente, aucun client créé, aucune facture.** | 1–2 j |
| **B — statu quo** | Community Manager = commercial + actions de prestation | 0 j |
| **C — intermédiaire** | Peut créer prospects/clients et vendre, mais ne voit que ses propres clients et ses prestations assignées ; pas de suppression | 1 j |

### 5.3 Scénario de recette associé (à valider)

Avec l'option A, le Community Manager doit pouvoir :
1. se connecter et voir **mes réalisations** studio/Agency assignées ;
2. démarrer une action, puis l'enregistrer comme réalisée (date, preuve, note) ;
3. **ne pas** voir l'entrée « Factures » ni « Clients » en création ;
4. **ne pas** accéder par URL à une facture (403) ;
5. ne voir que les prestations de son périmètre.

### 5.4 Ce que je fais à réception

- Mise à jour du seeder de permissions + adaptation des menus (`navItems.ts`).
- Contrôle de périmètre côté serveur (scope), pas seulement masquage UI.
- Test `CommunityManagerScopeTest` sur les 5 points ci-dessus.

---

## 6. Matrice des droits du rôle Caissier

### 6.1 Constat (vérifié en base)

Le rôle Caissier possède **49 permissions**. Le cahier des charges relève notamment
**5/5 en Comptabilité** et **4/4 en catégories comptables**, et demande une restriction au
périmètre de l'agence.

| Domaine | Permissions actuelles | Proposition |
|---|---|---|
| Factures | consulter, créer, imprimer, encaisser, valider | **garder** |
| Clients | consulter, créer, modifier, **supprimer** | garder les 3 premières, **retirer la suppression** |
| Comptabilité | **consulter, créer, modifier, supprimer, exporter** | **consulter + exporter** seulement |
| Catégories comptables | **consulter, créer, modifier, supprimer** | **consulter** seulement |
| Bilan | consulter, exporter | garder |
| Trésorerie | consulter, modifier | garder (caisses O/M/B déjà bloquées serveur) |
| Dépenses | consulter, créer, encaisser | garder |
| Commissions | consulter, encaisser | garder |
| Prestations | consulter, créer, **valider** | garder consulter + valider, **retirer créer** |
| Abonnements | consulter, créer, renouveler | garder |
| Employés / pays / catégories / services / produits | consulter | garder |
| Formations / sessions / inscriptions | consulter (+ créer, modifier inscriptions) | garder |
| Commandes, rapports | consulter | garder |

### 6.2 Ce qui est déjà validé et ne bouge pas

- La caissière **ne voit pas** les caisses `O`, `M`, `B` (403 serveur) : vérifié en recette (I2).
- Elle ne voit que les factures de son agence : vérifié en recette (I1).

### 6.3 Question à Pekegno

> **Valider la matrice ci-dessus ?** Si la caissière doit continuer à saisir des écritures
> comptables (dépenses, corrections), le préciser : dans ce cas on ne retire que
> `comptabilite.supprimer` et les catégories comptables en écriture.

### 6.4 Ce que je fais à réception

- Mise à jour du seeder de permissions + commande de rattrapage pour les comptes existants.
- Test `CashierPermissionsTest` (ce qui est autorisé / refusé) et contrôle des écrans.

---

## 7. Ordre d'exécution dès réception des réponses

| Étape | Contenu | Charge |
|---|---|---|
| 1 | T0.5 (B25) — motif « Date échue » + journal | 0,5–1 j |
| 2 | Matrice caissier (Lot 9) | 1 j |
| 3 | T0.3 — caisses Abidjan | 0,5 j |
| 4 | T0.4 — catégories et rattachement | 1 j |
| 5 | T0.6 — permissions et scénario Community Manager | 1–2 j |
| 6 | Mise à jour `AVANCEMENT.md` : Lot 5 = 100 %, Lot 9 = 100 % (hors 2FA) | 0,5 j |

Ensuite seulement : **Lot 3** (Administration par pays + publicité Pekegno), puis **Lot 7**
(séances datées en priorité).

---

## 8. Annexe — catalogue actuel à classer

| Libellé | Prix | Séminaire | Catégorie actuelle | Catégorie proposée |
|---|---|---|---|---|
| Bootcamp 3 jours, Yaoundé | 50 000 | oui | Store | **Séminaire** (automatique) |
| Canva Pro | 10 000 | non | Store | **Canva** |
| Livre « Comment Gagner de l'Argent en Ligne en Afrique » | 24 900 | non | Store | **Livre** |
| Logo ou Identité de marque | 25 000 | non | Store | **à préciser** |
| Tik Tok Monetise | 10 000 | non | Store | **à préciser** |
| Matootoo | — | — | *absent* | **à créer ?** |

> Chaque libellé existe une fois par agence (Douala, Yaoundé, Abidjan), soit 14 services.

---

## 9. Annexe — permissions actuelles du rôle Caissier (49)

`countries.consulter`, `categories.consulter`, `services.consulter`, `products.consulter`,
`clients.consulter`, `clients.creer`, `clients.modifier`, `clients.supprimer`,
`employes.consulter`, `invoices.consulter`, `invoices.creer`, `invoices.imprimer`,
`invoices.encaisser`, `invoices.valider`, `stats.consulter`, `comptabilite.consulter`,
`comptabilite.creer`, `comptabilite.modifier`, `comptabilite.supprimer`,
`comptabilite.exporter`, `accounting-categories.consulter`, `accounting-categories.creer`,
`accounting-categories.modifier`, `accounting-categories.supprimer`, `bilans.consulter`,
`bilans.exporter`, `abonnements.consulter`, `abonnements.creer`, `abonnements.renouveler`,
`tresories.consulter`, `tresories.modifier`, `courses.consulter`, `sessions.consulter`,
`enrollments.consulter`, `enrollments.creer`, `enrollments.modifier`, `orders.consulter`,
`reports.consulter`, `depenses.consulter`, `depenses.creer`, `depenses.encaisser`,
`commissions.consulter`, `commissions.encaisser`, `packages.consulter`, `prestations.consulter`,
`prestations.creer`, `prestations.valider`, `prestation-actions.consulter`,
`prestation-actions.modifier`.

---

## 10. Validation

| Décision | Réponse | Date | Validé par |
|---|---|---|---|
| T0.3 Caisses CI | ☐ A ☐ B ☐ C : ____________ | | |
| T0.4 Rubriques | ☐ A ☐ B — Tik Tok : ______ Logo : ______ | | |
| T0.5 Date échue | ☐ A ☐ B ☐ C — échéance : ____________ | | |
| T0.6 Community Manager | ☐ A ☐ B ☐ C | | |
| Matrice caissier | ☐ telle quelle ☐ avec exceptions : ____________ | | |
