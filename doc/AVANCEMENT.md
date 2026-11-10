# Avancement des corrections — V1 Pekegno

> **Référence** : `doc/PLAN_TRAVAIL_CORRECTIONS_WORLDEV_V1.md` (30 bugs B1–B30, 12 fonctions du CdC,
> 6 exigences de sécurité, checklist de réception).
> **Décision CA** : `doc/DECISION_CA_T0.2.md`.
> **Méthode** : confrontation du plan au code réel (services, contrôleurs, migrations, routes, tests, frontend).
> **Date de mise à jour** : 9 novembre 2026.

## Légende

| Statut | Signification |
|---|---|
| **FAIT** | Code présent et cohérent avec le plan ; test automatisé présent ou comportement couvert. |
| **PARTIEL** | Code présent mais incomplet (périmètre, écran ou cas limite manquant). |
| **À FAIRE** | Rien d'implémenté ou seulement des traces. |
| **BLOQUÉ** | Dépend d'une décision client (T0.x). |

> « FAIT » ici signifie **code livré** ; la recette staging (Lot 11) n'est pas encore déroulée.

---

## 1. Synthèse par lot

| Lot | Objet | Statut | Commentaire |
|---|---|---|---|
| **Lot 0** | Cadrage (T0.1–T0.7) | PARTIEL | T0.2 rédigé mais non contresigné ; T0.3/T0.4/T0.5/T0.6 non tracés. |
| **Lot 1** | Socle financier unique | FAIT | `FinancialMetricsService`, `Money`, `Period`, `received_at`, `/api/metrics/*`, façade `RevenueService`, test d'invariant. Seul T1.6 (7 rubriques) est reporté à T3.6. |
| **Lot 2** | Caisses, trésorerie, clôture | FAIT | Codes C/O/M/B, visibilité par rôle, transferts, `cash_closings`, écran de clôture. |
| **Lot 3** | Administration pays, 7 rubriques, publicité | À FAIRE | Seule la vente inter-agences (T3.13) est couverte. |
| **Lot 4** | Bugs P1 (B1–B16) | FAIT | Les 16 bugs P1 sont corrigés ; reste la recette staging (Lot 11). |
| **Lot 5** | Bugs P2 (B17–B26) | PARTIEL | B17/B18/B19/B20/B21/B22/B23/B24/B26 faits ; B25 attend T0.5. |
| **Lot 6** | Bugs P3 (B27–B30) | FAIT | B27/B28/B29/B30 faits. |
| **Lot 7** | Fonctions CdC manquantes | PARTIEL | Clôture, transferts, caisses obligatoires (Lot 2) et certificats vérifiables faits ; séances datées, contrats, cockpit, primes, import restent. |
| **Lot 8** | Contrôles de saisie | À FAIRE | Quasi rien : ni commercial/catégorie obligatoires, ni détection de doublons. |
| **Lot 9** | Sécurité | PARTIEL | 2FA existe mais non imposée ; centre de sécurité et audit de comptes absents. |
| **Lot 10** | Staging / exploitation | À FAIRE | Non démontrable depuis le dépôt. |
| **Lot 11** | Tests / recette 18 points | À FAIRE | Aucun point de réception coché en staging. |

---

## 2. Détail des bugs B1–B30

### Lot 4 — P1

| Réf | Statut | Preuve / fichier | Reste à faire |
|---|---|---|---|
| **B1** CA unique | FAIT | `FinancialMetricsService` consommé par `StatsController`, `DashboardController`, `ReportController`, `CommercialController` ; `RevenueService` = façade. `ExportController` n'agrège aucun CA : bilan via `BilanService`, reporting via `CommercialReportService`, comptabilité via le grand livre. | — |
| **B2** 7 cartes partout | FAIT | `FinancialKpiCards` sur Groupe, Pays, Agence, Département et `CashierDashboardPage` (cartes spécifiques caissier conservées en dessous). | — |
| **B3** Tableau de bord = liste | FAIT | `InvoiceListQuery` partagé, bornes `Period` (commit). | — |
| **B4** Ventes par catégorie | FAIT | `StatsController::salesByCategory` → `byCategory(..., 'collected')` ; `invoice_items.category_id` + backfill ; `SalesByCategoryTest`. | — |
| **B5** Totaux de période | FAIT | `BilanService::period` renvoie `totals` (flux cumulés, solde initial/final). | Test dédié `BilanPeriodTotalsTest` optionnel. |
| **B6** Solde initial / lecture pure | FAIT | `BilanService::treasuryDay` ; plus d'écriture de `DailyBalance` à la lecture. | Test dédié `BilanOpeningBalanceTest` optionnel. |
| **B7** Revenus potentiels | FAIT | `AcademyReportService::enrollmentsRevenue` (prix réel des inscriptions). | Test dédié `AcademyPotentialRevenueTest` optionnel. |
| **B8** Factures visibles | FAIT | Liste par défaut non annulées, motif d'annulation obligatoire + journal (commit). | — |
| **B9** Annulation en cascade | FAIT | `InvoiceCancellationService::reverseFinancials` appelé par `InvoiceController::cancel`. | Test dédié `InvoiceCancellationCascadeTest` optionnel. |
| **B10** Pagination comptabilité | FAIT | `AccountingController` pagine et calcule les totaux sur toute la requête. | — |
| **B11** Date de réception | FAIT | `invoice_payments.received_at` + usage caisse/bilan. | — |
| **B12** Bilan = Comptabilité | FAIT | `BilanEqualsAccountingTest` (commit). | — |
| **B13** Versement = transfert | FAIT | `transfer_type` + `is_transfer`, exclu des dépenses ; `ReclassifyTransferExpenses`. | — |
| **B14** Devises | FAIT | `formatCurrency(amount, currency)` ; libellés XOF/XAF. | Vérifier les écrans historiques qui codent encore « FCFA ». |
| **B15** Taux de recouvrement | FAIT | `collection_rate` calculé dans le service unique. | — |
| **B16** CA commercial ≠ agence profil | FAIT | `SalesTrackingController` / `CommercialController` sur `invoices.agency_id` ; `InterAgencySaleTest`. | — |

### Lot 5 — P2

| Réf | Statut | Preuve / fichier | Reste à faire |
|---|---|---|---|
| **B17** Panier moyen | FAIT | `panier_moyen = ca ÷ nb factures validées`. | — |
| **B18** Arrondi au franc | FAIT | `Money::franc` + `formatCurrency` arrondit (commit). | — |
| **B19** Colonnes preuves | FAIT | Réponse expose `invoice.client_name` + `amount` ; `PaymentProofsPage` les affiche. | Test dédié `PaymentProofColumnsTest` optionnel. |
| **B20** Statuts session/contrat | FAIT | `TrainingSession::getStatusAttribute` (statut calculé depuis les dates, annulée/terminée conservées) ; commande `contracts:refresh-status` (`ContractService::refreshStatuses`) planifiée 06:30. `StatusAutoRefreshTest`. | — |
| **B21** Abonnements actifs | FAIT | `StatsController` et `ReportController::subscriptions` comptent `Contract::open()` (active + due_soon) ; carte « Contrats actifs ». `ActiveContractsCardTest` (8). | — |
| **B22** Taux de présence | FAIT | `AttendanceStats` (présents / attendus sur séances passées), commit. | — |
| **B23** Cours globaux hors département | FAIT | `AcademyReportService::groupStats` filtre strictement sur les agences demandées. `DepartmentAcademyScopeTest` (14 / 11). | — |
| **B24** Branche produit/service | FAIT | Migration `add_branch_to_products_and_services` (backfill) ; `branch` sur `Product`/`Service` + ressources/requests ; `CatalogRevenueService` expose `branch` et `totals.by_branch` ; `SalesTrackingController` et `DepartmentLedger` utilisent la branche de l'article. `ProductBranchTest`. | Formulaire produit dédié absent côté front ; le champ est exposé par l'API. |
| **B25** « Date échue » | BLOQUÉ | Aucune occurrence dans le code. | Décision T0.5 (automatique ou manuelle), puis badge/journal ou liste de motifs. |
| **B26** Durée de session par rôle | FAIT | `InactivityLogout` : DG 12 h, autres 2 h, réglage `session_lifetime_minutes` (scalaire ou par rôle). `SessionLifetimeByRoleTest`. | — |

### Lot 6 — P3

| Réf | Statut | Preuve / fichier | Reste à faire |
|---|---|---|---|
| **B27** Classements clients | FAIT | `ReportController::customers` renvoie `by_country` et `by_city`. | — |
| **B28** Libellés de filtres / Journal | FAIT | `ReportFilters` / `ContextBar` : « Academy — Douala » ; `ActivityLogPage` : « Tous les utilisateurs » (i18n). | Le `AgencyDepartmentController` cité par le plan n'existe pas dans le dépôt. |
| **B29** Bornes « cette année » | FAIT | `Period` / `period.ts` en jour métier. | — |
| **B30** Prospects DG | FAIT | `ProspectController::scopeByRole` : DG/super-admin voient tout. | — |

---

## 3. Lot 3 — Administration, rubriques, publicité

| Tâche | Statut | Commentaire |
|---|---|---|
| T3.1 Type `administration` | À FAIRE | `AgencyActivity::TYPES = ['agency','academy']`. |
| T3.2 Administration par pays | À FAIRE | Pas d'entité ni de seeder. |
| T3.3 Rapatriement dépenses admin | À FAIRE | Commande de migration de données absente. |
| T3.4 Vue Pays à deux corps | À FAIRE | — |
| T3.5 Bilan ventes / caisses | PARTIEL | Le Bilan expose déjà les caisses (Lot 2), pas la séparation Admin/Agences. |
| T3.6 `sale_rubrics` | À FAIRE | Bloque T1.6. |
| T3.7 7 rubriques dans Bilan/rapports | À FAIRE | — |
| T3.8 `ad_campaigns` | À FAIRE | — |
| T3.9 Pub locale → agence | À FAIRE | — |
| T3.10 Pub nationale au prorata | À FAIRE | — |
| T3.11 Résultat avant/après pub | À FAIRE | — |
| T3.12 Budget pub client (pass-through) | FAIT | Déjà géré (D7) côté facture/bilan. |
| T3.13 Ventes inter-agences | FAIT | `SaleAgencyResolver` + `InterAgencySaleTest`. |
| T3.14 Dépense liée à un événement | À FAIRE | Champ `event_id` absent. |

---

## 4. Lot 7 — Fonctions du CdC

| Fonction | Statut | Commentaire |
|---|---|---|
| Clôture de caisse journalière | FAIT | Lot 2 (`cash_closings`, écran, validation). |
| Transferts | FAIT | Lot 2 (`transfer_type`, `is_transfer`). |
| Caisses de trésorerie obligatoires | FAIT | Lot 2 (`TreasuryAccountProvisioner`, contrôle 422). |
| Entité Administration | À FAIRE | Voir Lot 3. |
| Présences par séance | À FAIRE | Pas de `session_occurrences` ; le lien « Présences » ouvre les sessions. |
| Certificats vérifiables | FAIT | `GET /api/public/certificates/{serial}/verify` (sans auth, numéro `CERT-xxxxx`, motif si révoqué) + page publique `/verifier-certificat` (`frontend_client`) ; test `PublicCertificateVerificationTest`. |
| Contrats Agency (circuit + alertes) | PARTIEL | `ContractService` et alertes existent, circuit/commande à finaliser. |
| CRM | PARTIEL | Pipeline présent ; visibilité/permissions/relances à vérifier. |
| Dépenses (circuit visible) | PARTIEL | Circuit présent ; stepper + justificatif photo obligatoire à vérifier. |
| Moteur de primes | PARTIEL | Règles paramétrées ; versionnement non exposé ; ne pas lancer octobre avant B1. |
| Cockpit par employé | À FAIRE | Démonstration staging + écran absents. |
| Notifications | PARTIEL | Cloche présente ; déclencheurs créance/renouvellement/écart à tester. |
| Import historique | À FAIRE | Journal d'import + anomalies + reprise des centimes. |

---

## 5. Lots 8, 9, 10, 11

### Lot 8 — Contrôles de saisie

| Tâche | Statut |
|---|---|
| T8.1 Commercial + catégorie obligatoires | À FAIRE (`commercial_id` nullable, catégorie non imposée). |
| T8.2 Alerte doublon facture | À FAIRE |
| T8.3 Alerte client existant (nom/téléphone) | À FAIRE |
| T8.4 Format email/téléphone par pays | À FAIRE |
| T8.5 Formateur obligatoire pour une session | PARTIEL (validations formateur présentes, caractère obligatoire à confirmer). |

### Lot 9 — Sécurité

| Exigence | Statut |
|---|---|
| Comptes nominatifs / audit des comptes | À FAIRE (pas de commande `security:audit-accounts`). |
| 2FA obligatoire par rôle | PARTIEL (`TwoFactorService` existe, non imposé). |
| Droits du rôle Caissier | À FAIRE (matrice à revoir avec le client). |
| Centre de sécurité Super Admin | À FAIRE. |
| Environnements séparés | À FAIRE. |
| Sauvegardes / export / code / NDA | À FAIRE (preuves écrites). |

### Lots 10 et 11

| Élément | Statut |
|---|---|
| Staging `staging.pekegnogroup.com` | À FAIRE |
| Un compte de test par rôle | À FAIRE |
| Fermeture accès développeur + journalisation | À FAIRE |
| Restauration testée et datée | À FAIRE |
| Accès dépôt / hébergement | À FAIRE |
| NDA signé | À FAIRE |
| Checklist de réception (18 points) | À FAIRE |

---

## 6. Tests

### Tests présents (nouveaux chantiers)

`FinancialMetricsConsistencyTest`, `BilanEqualsAccountingTest`, `SalesByCategoryTest`,
`InvoiceAlwaysVisibleTest`, `AttendanceRateConsistencyTest`, `TreasuryCashClosingTest`,
`PaymentTreasuryRoutingTest`, `TreasuryControlsTest`, `InterAgencySaleTest`,
`StatusAutoRefreshTest`, `DepartmentAcademyScopeTest`, `SessionLifetimeByRoleTest`,
`ProductBranchTest`, `ActiveContractsCardTest`, `PublicCertificateVerificationTest`.

### Tests attendus au plan et absents (nommage exact)

`BilanPeriodTotalsTest`, `BilanOpeningBalanceTest`, `BankDepositIsTransferTest`, `CashClosingTest`,
`TreasuryVisibilityTest`, `AcademyPotentialRevenueTest`, `InvoiceCancellationCascadeTest`,
`AccountingPaginationTest`, `PaymentReceivedDateTest`, `PaymentProofColumnsTest`,
`AdCampaignAllocationTest`, `AdminEntityTest`.

> Plusieurs comportements sont déjà couverts par les tests présents ; ces fichiers manquent surtout
> pour verrouiller la non-régression des bugs corrigés.

### Échecs connus (CLAUDE.md)

- ~31 tests : `GD extension is not installed` — ne se produisent pas sur PHP 8.3 hôte (GD présent).
- 5 tests : preuve de paiement obligatoire pour `responsable-agence`.
- 1 test : `ClientPackageSubscriptionTest` (avance plafonnée).
- 1 test préexistant : `Phase5CommercialValidationTest::test_commercial_stats_rise_after_validation_and_collection` (vérifié sur HEAD, sans lien avec les corrections).

**Commande** : `php artisan test` depuis `backend/` (PHP 8.3 hôte) ; alternative conteneur `docker exec pekegno-server php artisan test`.

---

## 7. Écarts documentation / code

1. Le plan n'a de section « Avancement » que pour les Lots 1 et 2 ; B3, B4, B8, B12, B18, B22 ne sont pas répercutés.
2. `DECISION_CA_T0.2.md` dit `treasury_account_id` obligatoire « Reporté », alors que le Lot 2 le marque fait.
3. Le rapport `doc/RAPPORT_TEST_LOTS_1_2_2026-11-07.pdf` sert de preuve pour les Lots 1–2.
4. La recette staging n'a pas été déroulée : tous les statuts « FAIT » restent à valider en Lot 11.

---

## 8. Prochaines étapes prioritaires

1. **Vérifier la suite de tests** et confirmer que la liste des échecs connus n'a pas bougé.
2. **B25** dès décision T0.5 ; les autres P2/P3 sont faits.
3. **Lot 3** dès validation de T0.3 (caisses CI) et T0.4 (mapping 7 rubriques) : Administration puis `sale_rubrics` (débloque T1.6), ensuite publicité.
4. **Lot 7** : séances datées en priorité, puis contrats Agency, cockpit par employé, primes et import historique.
5. **Lot 8** : contrôles de saisie.
6. **Lot 9** : 2FA obligatoire puis centre de sécurité.
7. **Staging (Lot 10) en parallèle**, recette (Lot 11) en dernier.
