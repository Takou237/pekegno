# Déploiement + recette — 13/10/2026 (lot Agency + suivi + commissions)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(piqûres §3.1 → §3.9 — relire avant d'agir, surtout §3.2 Importer,
§3.4 OPcache, §3.9 cache de routes).

État prod de départ : migrations jusqu'à
`2026_09_30_000003_add_payer_phone_to_invoices_table`
(+ `repair-converted-clients-2026-10-01.sql` = données seules, à appliquer
séparément s'il ne l'est toujours pas).

## 1. Ce qui change (code déjà poussé sur GitHub, branche `master`)

| # | Changement | Partie |
|---|---|---|
| 1 | Comptabilité `/accounting` : le **caissier** ne voit/modifie que son agence (scope backend + filtre forcé frontend) | Backend + Frontend |
| 2 | Suivi des actions département : **filtre de périodicité** (De → À + raccourcis Aujourd'hui, Hier, Cette semaine, Semaine dernière, Ce mois, Mois dernier, 30 derniers jours, Cette année) | Backend + Frontend |
| 3 | Créer un service : **Type de commission + Valeur** propres au service (prioritaires sur le commercial, après l'ancienne prime fixe) ; **Prime fixe retirée** du formulaire (le « Montant fixe » la remplace) ; **Publier sur le catalogue coché par défaut** | Backend + Frontend |
| 4 | Classement par points : **champ de recherche retiré**, tri par Points / Ventes / CA / Commission (sélecteur + en-têtes cliquables) | Backend + Frontend |
| 5 | Enregistrer une réalisation : **fichier de preuve** (image ou document, max 10 Mo) en plus du lien URL, modales exécution + manuelle | Backend + Frontend |
| 6 | Équipier **caissier** : peut enregistrer ses actions attribuées (`prestation-actions.modifier` accordé) ; portail client : **preuves/liens visibles** par action notée ; commercial : bouton **Nouvelle prestation** dans l'onglet Packages + droits `prestations.creer` | Backend + Frontend + Client |
| 7 | Nouvelle prestation : **champ Département retiré** (seul le déploiement multi-pays compte, département résolu côté backend) ; `AgencyPolicy`/`DepartmentPolicy` : commercial/caissier lisent leur périmètre (fini le toast 403) | Backend + Frontend |
| 8 | Socle Agency en base : catégories, rôles équipe, packages enrichis, prestations, actions (+ commentaires/journal/notes), notifications, exécutions, offres, annuaire équipiers, contrats, liens factures/commissions, `department_id` comptable, fiche client, commission service, preuves fichier | Base (ce dossier) |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-10-13.sql` | Schéma + données (28 migrations) + lignes `migrations` | Importer **en 1er** |
| `seed-permissions-2026-10-13.sql` | 16 permissions Agency + rôle `community-manager` + associations par rôle (miroir `RoleSeeder`) + rattrapage caissier | Importer **en 2e** |
| `seed-commercial-reporting.sql` | Droit `commercials.reporting` (+ `consulter`) au commercial : pages Suivi des ventes + Rapport mensuel (403 en prod car absent du seed de septembre) | Importer **en 3e** |
| `frontend-dist.zip` | Build admin (`VITE_API_URL=https://pekegnogroup.com/api`), `.htaccess` inclus | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison : importé **2 fois de suite** sur base vide
(`schema.sql` + migrations 28/29/30/2fa/payer-phone + `seed-roles-permissions.sql`),
zéro erreur, vérifié 16 permissions / 28 lignes `migrations` / rôle
`community-manager` / réglages commission / grants par rôle.
`composer.json`/`composer.lock` **inchangés** → pas de rebuild `vendor/`.

## 3. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Base — schéma** : phpPgAdmin → base → onglet **Importer** →
   `13_10/migration-2026-10-13.sql`. Attendu : succès, plein de `NOTICE`
   « already exists, skipping » si rejoué (normal).
3. **Base — droits** : même onglet **Importer** →
   `13_10/seed-permissions-2026-10-13.sql`. Attendu : succès.
4. **Contrôles** (boîte SQL → `SELECT` uniquement) :
   ```sql
   SELECT count(*) FROM permissions WHERE name LIKE 'packages.%' OR name LIKE 'prestations%' OR name LIKE 'prestation-actions%' OR name LIKE 'equipe-client%';  -- attendu : 16
   SELECT count(*) FROM migrations WHERE migration LIKE '2026_10%';  -- attendu : 28
   SELECT key, value FROM settings WHERE key LIKE 'default_commission%';  -- percent / 20
   SELECT to_regclass('public.prestations'), to_regclass('public.prestation_offers'), to_regclass('public.team_members');  -- 3 lignes non NULL
   SELECT p.name FROM roles r JOIN role_permission rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id WHERE r.name = 'commercial' AND p.name LIKE 'commercials.%';  -- consulter + reporting
   ```
5. **Code backend** : `git push` fait → cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
6. **Caches** : SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (§3.9), puis **vider l'OPcache** via `reset-opcache.php` (§3.4) et
   **supprimer** le fichier.
7. **Frontend admin** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `13_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`, cf. 01/10). Vérifier `.htaccess` présent (fichiers cachés).
8. Navigateur : **Ctrl+Maj+R**, puis recette ci-dessous.

Retour arrière : restaurer la sauvegarde (1), repointer le dépôt sur le commit
précédent, réuploader l'ancien build. Les nouvelles tables/colonnes sont sans
effet sur l'ancien code.

## 4. Recette

- [ ] Caissier → `/accounting` : uniquement son agence (plus de sélecteurs pays/agence), création/modif OK dans son agence.
- [ ] Super-admin → `/departments/:id/actions` : filtre De → À + 8 raccourcis de période, budget cohérent.
- [ ] Créer un service : **pas de Prime fixe**, bloc Type (`Pourcentage`) + Valeur (`20` par défaut), Publier **coché** par défaut.
- [ ] Classement par points : **pas de recherche**, sélecteur Trier par + en-têtes cliquables (Points/Ventes/CA/Commission).
- [ ] Action → Enregistrer la réalisation : champ **fichier** (image/PDF/DOC/MP4, 10 Mo), aperçu image, lien fichier visible après enregistrement.
- [ ] Caissier assigné → `/team/.../actions/...` : bouton **Marquer comme fait** présent, enregistrement OK (fini le 403).
- [ ] Client → `/mon-compte/prestations` : preuves (lien + fichier + note + date) visibles sous chaque action notée.
- [ ] Commercial → `/catalog/services` onglet Packages : bouton **Nouvelle prestation** (Nom/Catégorie/Actif/Description/Déployer pays, **sans Département**), création OK sans toast 403 ; catégorie d'un autre département acceptée (recréée dans l'agence cible).
- [ ] Commercial → `/sales-tracking` et `/commercials/monthly-report` : ouverture **sans** toast 403 (droit `commercials.reporting` via `seed-commercial-reporting.sql`), ne voit que ses propres ventes.
- [ ] Service avec commission `fixe`/`percent` : commission calculée au taux du service à l'encaissement (avant : taux du commercial).
