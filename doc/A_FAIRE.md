# A FAIRE

> Suivi des demandes. Légende : ✅ fait · ⏳ partiel / à valider · ❌ à faire.
> Statuts vérifiés dans le code le 15/10/2026.

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

- [ ] ⏳ **Création d'un nouvel apprenant complète** (mêmes éléments que « nouvelle inscription → nouvel apprenant») : flux de création existant, conformité des champs à valider visuellement.
- [x] ✅ **Informations de l'apprenant modifiables (éditable)** : `PUT /api/learners/{learner}` + formulaire d'édition sur la fiche apprenant (mêmes 10 champs que la création) ; permission `clients.modifier` accordée au rôle commercial ; contrôle du périmètre organisationnel ; tests `LearnerUpdateTest` (8/8).

## Facture (nouveaux besoins)

- [ ] ❌ **Service de facture : choisir produit ou formation** et permettre d'ajouter un produit inexistant (enregistré comme produit sur la facture). Le backend accepte déjà une ligne « produit » ou « service » avec libellé libre, mais `InvoiceFormPage` ne propose pas encore le sélecteur produit/formation ni la création de produit à la volée.
- [x] ✅ Voir « Impression facture impayée ou partielle » ci-dessus : fait.

## Chiffres / cohérence

- [ ] ⏳ **Bilan du jour ≠ vue d'ensemble / comptabilité** + **l'agence ne doit pas dépasser le département en chiffre d'affaires** : correction en cours (modifications présentes sur `BilanService`, `StatsController`, `DashboardController`, `RevenueService`, `DepartmentLedger`, `GroupCurrency`), à valider avec les chiffres réels.
- [ ] ❌ **Chiffre d'affaires de la Côte d'Ivoire à 0 XOF** : à diagnostiquer avec les données (probable souci de rattachement d'agences au pays).

## Dépenses / paramètres

- [ ] ⏳ **Dépenses dans le dashboard Pekegno Groupe (et partout)** : affiché dans `PEKEGNOGroupDashboard` (`expenses_total`), mais absent des dashboards caissier, pays et academy.
- [x] ✅ **Paramètres au niveau Pekegno Groupe (comme dans le pays)** : l'entrée « Paramètres » pointe vers la même page `SettingsPage` que le pays (route `/settings`) ; ajoutée au menu des rôles du groupe (super-admin, direction-generale) dans `navItems.ts` (`Sidebar` + `MobileNav`).

## Utilisateurs

- [x] ✅ **Filtre par rôle dans la page Utilisateurs** (Paramètres) : select filtre par rôle + filtres agence/département/recherche (`UserListPage` : `role_id`).

## Commercial — prestations

- [ ] ⏳ **« Nouvelle souscription » à la place de « nouvelle prestation »** (formulaire comme la nouvelle vente, mais pour les prestations) : les pages de souscription pack/offre existent (génèrent contrat + prestation + facture via `PackageController.subscribe`), la conformité du formulaire reste à valider visuellement.
- [x] ✅ **Validation par le caissier / super admin puis facture + contrat** : workflow `prestations.valider` (validation/rejet) ; la souscription génère contrat, prestation pré-remplie et facture.

## Caissier

- [ ] ❌ **Suivi de certains caissiers à 0 alors qu'elles ont effectué des actions** : à diagnostiquer avec les données (vraisemblablement le filtre de scope de `SalesTrackingController` qui rate des agences).
