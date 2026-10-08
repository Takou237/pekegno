
## 11. Déjà fait (2026-10-08) — ne pas refaire

- [x] **UI1** — Champ **« Unité » retiré** : formulaire Contenu du package (`AgencyDeptPackagesPage`), formulaire Nouvelle/Édition action (`PrestationDetailPage`, `PrestationActionDetailPage`) + affichages `{quantity} {unit}` remplacés par `{quantity} ×`. Clé i18n `agencyDept.unit` supprimée (fr/en).
- [x] **UI2** — Contenu du package : ajout **manuel** (bouton existant) **+ sélection depuis une liste des prestations du département** (Select « Ajouter depuis une prestation existante… », pré-remplit le libellé). `AgencyDeptPackagesPage` charge `prestations({department_id, per_page:100})`.
- [x] **UI3** — Onglet **« Suivi des prestations » retiré** de la page Prestations : `components/agencyDept/PrestationTabs.tsx` supprimé, `<PrestationTabs />` retiré de `PrestationListPage` et `PrestationTrackingPage`. La route `/prestations/tracking` reste accessible si besoin.
