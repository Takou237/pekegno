# Recette staging - 18 points client (12/11/2026)

Reference : `doc/PLAN_TRAVAIL_CORRECTIONS_WORLDEV_V1.md` §14.1 (tests), §14.2
(checklist 18 points), §14.3 (scenarios par role).

Kit de deploiement associe : `doc/deploy/12_11/README.md`.

## Mode d'emploi

1. Deployer le lot `12_11` sur l'environnement de test (cf. README deploy).
2. Charger le jeu de recette (31/10 -> 03/11/2026) : `RecetteDatasetSeeder`
   (a defaut, la base anonymisee de production).
3. Creer **un compte par role** (etape 18) et verifier le scheduler.
4. Pour chaque point : derouler l'etape staging, comparer a l'attendu, cocher.
5. Rejouer les tests cibles en local avant/apres :
   `cd backend; php artisan test --filter=NomDuTest`.

Legende statut :

- **OK test** : couvert par un test automatise vert ; reste a confirmer visuellement en staging.
- **Partiel** : couverture partielle ; un controle manuel est indispensable.
- **Manuel** : pas de test automatise ; a derouler en staging.

> Echecs de tests connus (ne pas confondre avec une regression, cf. `CLAUDE.md`) :
> ~31 tests `GD extension is not installed`, 5 tests de preuve de paiement
> obligatoire `responsable-agence`, 1 test `ClientPackageSubscriptionTest`.
> Verifier que la liste ne change pas.

## 18 points de reception

| # | Point client | Attendu | Preuve automatisee | A verifier en staging | Statut |
|---|---|---|---|---|---|
| 1 | CA 2026 identique partout (B1) | Meme CA sur Tableau de bord, Pays, Comparaison CA, Rapport clients, Comptabilite | `FinancialMetricsConsistencyTest`, `BilanEqualsAccountingTest::test_the_shared_metric_and_accounting_agree_on_collected`, `CommercialRevenueConsistencyTest` | Comparer les 5 ecrans sur la meme periode (2026) | OK test |
| 2 | Cartes de la section 1 en tete des tableaux de bord (B2) | 7 cartes identiques en tete de Groupe, Pays, Agence/Departement, Caissier | `FinancialKpiTest` ; `FinancialKpiCards.tsx` | Ouvrir les 4 tableaux de bord et verifier l'ordre + le clic (details scope) | OK test |
| 3 | 02/11 : 10 factures dont 2 a Yaounde (B3) | 10 factures le 02/11, 2 rattachees a Yaounde | Pas de test dedie ; proche de `SaleAgencyAndBilanTest`/`Phase5BilanTest` | Filtrer 02/11 sur la liste des factures et le tableau de bord ; compter les agences | Partiel |
| 4 | « Sans categorie » <= total facture (B4) | Part « Sans categorie » jamais superieure au CA ; lignes classees par categorie | `SalesByCategoryTest`, `CorrectionsP1Test::test_sales_by_category_add_up_to_revenue_and_classify_each_line` | Rapport ventes par categorie : somme = CA, « Sans categorie » <= CA | OK test |
| 5 | Soldes du Bilan justes, jour par jour et total periode (B5, B6) | Solde initial = somme des soldes finaux de la veille ; total periode = 1er initial / dernier final | `Phase5BilanTest::test_daily_bilan_opening_balance_from_previous_day`, `BilanTreasuryAndLedgerTest` | Verifier 02/11 et 03/11 puis le total 31/10->03/11 | OK test |
| 6 | Revenus potentiels CRS-00001 <= 6 615 000 (B7) | Somme des prix des inscriptions, sans double comptage des parts | `CorrectionsP1Test::test_potential_revenue_counts_each_enrollment_share_once` | Fiche CRS-00001 : revenus potentiels <= 6 615 000 | OK test |
| 7 | PK-20261101-009 visible avec son statut (B8) | La facture apparait dans la liste (filtre annulee repare), statut correct | `InvoiceAlwaysVisibleTest` | Rechercher PK-20261101-009, verifier statut et detail | OK test |
| 8 | Montants d'Abidjan en XOF et convertis dans les totaux groupe (B14) | Devise locale XOF ; totaux groupe convertis selon le taux | `CorrectionsP1Test` (currency_code XOF), `Phase7ReportingTest` | Vue multi-pays : montants Abidjan en XOF, total groupe coherent | OK test |
| 9 | Caisse C de Douala au 02/11 : 381 000 puis 131 000 ; O et M separees | Solde C = 381 000 (avant) puis 131 000 (apres) ; O et M distinctes | `BilanTreasuryAndLedgerTest` (381 000), `PaymentTreasuryRoutingTest` (caisse O) | Bilan/caisses au 02/11 : verifier C, O, M ; le 131 000 est a confirmer | Partiel |
| 10 | Versement en banque = transfert, pas depense (B13) | Aucune depense comptee ; mouvement de transfert uniquement | `TreasuryControlsTest::test_reclassify_command_turns_legacy_bank_deposits_into_transfers`, `TreasuryCashClosingTest` | Saisir un versement C -> B : il sort de la caisse sans depense | OK test |
| 11 | Caissiere ne voit pas les soldes O/M/B | Seule la caisse C (especes) visible pour la caissiere | `PaymentTreasuryRoutingTest` (`TreasuryAccountProvisioner::RESTRICTED_ROLES`), `TreasuryControlsTest` | Connexion caissiere : caisses O/M/B absentes | OK test |
| 12 | Pub nationale Academy repartie au prorata du CA Academy | Local = 100 % agence cible ; national = prorata CA branche | `AdCampaignAllocationTest` | Creer une campagne locale + une nationale, verifier le rapport d'agence | OK test |
| 13 | Vente inter-agences comptee une fois, pour Douala et pour la commerciale (B16) | Une seule vente, attribuee a l'agence de la facture et a la commerciale | `InterAgencySaleTest` | Vendre un produit d'une autre agence ; verifier CA Douala + classement commerciale | OK test |
| 14 | Un formateur peut faire l'appel d'une seance | Feuille de presence datee, deux dates acceptees, meme date dedupliquee | `SessionAttendanceTest`, `AttendanceRateConsistencyTest` | Compte formateur : appel sur 2 dates, verifier la feuille et l'export CSV | OK test |
| 15 | Comptes partages supprimes ; 2FA active | Plus de compte partage ; 2FA imposee/active | `SecurityAuditAccountsTest`, `TwoFactorEnforcementTest`, `TwoFactorStatusTest` | Lister les comptes actifs, verifier 2FA par role | Partiel |
| 16 | Chaque role deroule son scenario sans erreur | Aucune erreur 500/403 inattendue, perimetre respecte | - | Scenarios §14.3 ci-dessous | Manuel |
| 17 | Bugs P2 et P3 corriges ou dates | Corrections livrees ou ticket date | `CorrectionsP1Test` + tests P2/P3 : `PaymentProofRejectionReasonTest`, `StatusAutoRefreshTest`, `AttendanceRateConsistencyTest`, `DepartmentAcademyScopeTest`, `ProductBranchTest`, `SessionLifetimeByRoleTest`, `DefaultPeriodTimezoneTest`, `ActiveContractsCardTest`, `RecoveryPaymentsTest`, `CashierInvoiceScopeTest`, `ClientContactValidationTest`, `ClientDuplicateWarningTest`, `InvoiceDuplicateWarningTest`, `GlobalClientSearchTest`, `InvoiceSearchTest`, `LearnerUpdateTest`, `UserAssignmentUpdateTest`, `UsernameSuggestionTest`, `SoftDeletedUserNumberingTest`, `UserGroupConsistencyTest` | Parcourir le cahier P2/P3 et pointer ce qui reste non date | Partiel |
| 18 | Environnement de test operationnel avec un compte par role | Staging accessible, un compte par role, scheduler actif | - | Verifier les 8 comptes (§14.3) et `schedule:run` (dont `invoices:check-overdue` 06:45) | Manuel |

## Scenarios par role (§14.3)

| Role | Scenario | Points surveilles |
|---|---|---|
| Caissier | Valider puis rejeter une preuve ; paiement partiel sur ancienne facture ; cloture de la caisse C | 9, 10, 11, 15 |
| Commercial | Creer un prospect, le convertir, facturer avec avance ; ne voir que ses clients | 13, 16 |
| Formateur | Voir ses sessions, faire l'appel ; ne voir ni montants ni autres agences | 14, 16 |
| Community Manager | Perimetre T0.6 (executant de prestations, plus de vente) | 15, 16 |
| Responsable Agence | Voir/valider son agence uniquement ; saisir une depense | 9, 10, 16 |
| Responsable Departement | Creer une session avec formateur ; ne voir que sa branche | 14, 16 |
| Comptable | Saisir une depense Administration ; exporter un mois | 1, 17 |
| Direction generale | Voir caisses O/M/B ; memes totaux partout | 1, 11 |

## Fiche de suivi (a remplir en staging)

| # | Testeur | Date | OK / KO | Preuve (capture, ID) | Commentaire |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |
| 15 | | | | | |
| 16 | | | | | |
| 17 | | | | | |
| 18 | | | | | |

## Commandes utiles

```powershell
# Tests cibles du lot (PHP 8.3)
cd backend
php artisan test --filter="AdCampaignAllocationTest|AdminEntityTest|SessionAttendanceTest|OverdueInvoiceNotificationTest|AttendanceRateConsistencyTest"

# Regression financiere / caisses
php artisan test --filter="FinancialKpiTest|CorrectionsP1Test|TreasuryCashClosingTest|TreasuryControlsTest|PaymentTreasuryRoutingTest|BilanTreasuryAndLedgerTest"

# Scheduler (staging)
php artisan schedule:list
php artisan invoices:check-overdue
```
