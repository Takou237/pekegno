# A FAIRE

> Suivi des demandes. Légende : ✅ fait · ⏳ partiel / à valider · ❌ à faire.
> Statuts vérifiés dans le code le 16/10/2026.

## Factures

- [x] ✅ **Versements multiples** : colonne indiquant l'ordre du reçu et la date/heure dans la même colonne (`InvoiceDetailPage` : `#{index + 1}` + `formatDateTimeFr(p.paid_at)` ; reçu imprimable `PaymentReceiptPrint` avec « Ordre (#) »).
- [x] ✅ **Impression facture impayée ou partielle** réservée au super admin et au caissier (`InvoiceDetailPage` : `canPrintUnpaid` = `['super-admin', 'caissier']`).

## Comptabilité

- [x] ✅ **Numéros classés du plus récent au plus ancien** dans toute la comptabilité (`AccountingPage` ligne 144 ; les pages agence et département réutilisent ce même composant).
- [x] ✅ **Heure dans la colonne de date** (ex. « 15/10/2026 à 10h30 ») via `formatDateTimeFr` (fuseau métier Africa/Douala). Corrigé au passage dans la Trésorerie (`TreasuryPage` affichait la date sans heure).

## Formateur

- [x] ✅ **Lier un compte utilisateur avec un SELECT** : `AcademyTrainersPage` propose un select de comptes éligibles ; le backend refuse un utilisateur sans le rôle « formateur » ou déjà lié à un autre profil (422).
- [x] ✅ **Dashboard formateur** (`/formateur/dashboard`, `TrainerDashboardPage`) : formations, apprenants, sessions récentes et planning à venir.

## Employés

- [x] ✅ **Menu Employés = tous les rôles hors formateur et commercial** (`CommercialController::EMPLOYEE_ROLES` : caissier, comptable, community-manager, responsable-département, responsable-agence, DG, super-admin + routes `/employees`).

## Compte commercial

- [x] ✅ **Création d'un nouvel apprenant complète** (mêmes éléments que « nouvelle inscription → nouvel apprenant») : `EnrollmentLearnerField` (9 champs) aligné partout — `FormationEnrollmentModal`, `FormationEnrollmentPage`, `QuickSaleModal`, `PrestationFormModal`, `PackageSubscribeModal` envoient city/country/nationality/quartier/occupation + `registered_agency_id` + `commercial_user_id`, email normalisé (`undefined` → backend génère `uuid@sans-email`) ; `ClientPayload.commercial_user_id` ajouté.
- [x] ✅ **Informations de l'apprenant modifiables (éditable)** : `PUT /api/learners/{learner}` + formulaire d'édition sur la fiche apprenant (mêmes 10 champs que la création) ; permission `clients.modifier` accordée au rôle commercial ; contrôle du périmètre organisationnel ; tests `LearnerUpdateTest` (8/8).

## Facture (nouveaux besoins)

- [x] ✅ **Service de facture : choisir produit ou formation** et permettre d'ajouter un produit inexistant (enregistré comme produit sur la facture) : `InvoiceFormPage` propose sélecteur Service / Produit / Libellé libre + recherche `productsApi` + création à la volée (`POST /products`) ; `QuickSaleModal` supporte aussi service+produit ; `product_id` câblé (`types/invoice`, `invoices.api.createWithProof`) ; backend `StoreInvoiceRequest` corrigé (`label required_without_all service,product`).
- [x] ✅ Voir « Impression facture impayée ou partielle » ci-dessus : fait.

## Chiffres / cohérence

- [x] ✅ **Bilan du jour = vue d'ensemble / comptabilité** + **l'agence ne dépasse pas le département** : CA unifié = encaissé net `paid_at` hors pass-through partout (`monthlyRevenue`, `topAgencies`, `topCommercials`, tops overview/agency/country via `RevenueService`) ; invariant agence→département garanti par `DepartmentLedger` (orphelines → Agency).
- [x] ✅ **Chiffre d'affaires de la Côte d'Ivoire à 0 XOF** : cause = `country_id` NULL (filtres `whereIn([])`) malgré `country='Côte d'Ivoire'` ; repli libellé legacy via `Agency::idsForCountry` (`Stats`, `RevenueService`, `Dashboard`, `Bilan`) + migration de rattrapage `2026_10_16_000001_backfill_agency_country_city_fk` + flag `has_agencies` / bandeau `countryNoAgency`.

## Dépenses / paramètres

- [x] ✅ **Dépenses dans le dashboard Pekegno Groupe (et partout)** : `expenses_total` + `net_cash` ajoutés à `overview` (caissier), `country`, `agency`, `dashboard` hiérarchique et `trainingGroup` (academy) ; cartes Dépenses dans `CashierDashboardPage`, `CountryDashboardPage`, `AcademyDashboardPage` + détail par pays dans `PEKEGNOGroupDashboard`.
- [x] ✅ **Paramètres au niveau Pekegno Groupe (comme dans le pays)** : l'entrée « Paramètres » pointe vers la même page `SettingsPage` que le pays (route `/settings`) ; ajoutée au menu des rôles du groupe (super-admin, direction-generale) dans `navItems.ts` (`Sidebar` + `MobileNav`).

## Utilisateurs

- [x] ✅ **Filtre par rôle dans la page Utilisateurs** (Paramètres) : select filtre par rôle + filtres agence/département/recherche (`UserListPage` : `role_id`).

## Commercial — prestations

- [x] ✅ **« Nouvelle souscription » à la place de « nouvelle prestation »** (formulaire comme la nouvelle vente, mais pour les prestations) : titres/boutons unifiés (`prestations.new` = « Nouvelle souscription », `PrestationFormModal` toujours `newSubscription` + bandeau vente) ; doublon `SubscribeModal` supprimé (`AgencyDeptPackagesPage` utilise `PackageSubscribeModal` avec avance/paiement/preuve comme la vente).
- [x] ✅ **Validation par le caissier / super admin puis facture + contrat** : workflow `prestations.valider` (validation/rejet) ; la souscription génère contrat, prestation pré-remplie et facture.

## Caissier

- [x] ✅ **Suivi de certains caissiers à 0 alors qu'elles ont effectué des actions** : `SalesTrackingController` applique le scope agences, accepte `seller_user_id` (ventes de guichet, `commercial_id` NULL) + `cashier_id` (`payments.received_by`), et ne force plus `commercial_id=0000…` quand le commercial n'a pas de profil (repli `seller_user_id`) ; front : filtre « Vendeur (guichet) » + recherche commerciaux **et** employés.
