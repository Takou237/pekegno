# Déploiement + recette — 14/10/2026 (fix équipe client, rôles, onglets, combobox)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(pièges §3.1 → §3.9 — relire avant d'agir, surtout §3.4 OPcache,
§3.9 cache de routes).

État prod de départ : **lot du 13/10/2026 appliqué** (`13_10/` : schéma,
permissions, `seed-commercial-reporting.sql`, build frontend du 13/10).
Si le 13/10 n'est pas encore passé en prod, l'appliquer **d'abord**
(voir `13_10/README.md`), puis enchaîner celui-ci.

## 1. Ce qui change (code poussé sur GitHub, branche `master`, commit `e7981dc`)

| # | Changement | Partie |
|---|---|---|
| 1 | **Équipe client** (`/departments/:id/client-team`) : ne plante plus en prod. Les affectations sans compte (`user_id` null) sont exclues de l'onglet Affectations (visibles dans l'Annuaire) et les comptes supprimés sont filtrés ; le frontend est null-safe | Backend + Frontend |
| 2 | **Rôles personnalisés** : un rôle créé depuis « Rôles & Permissions » apparaît désormais dans les listes de Créer/Modifier un utilisateur (avant : seuls 6 rôles en dur). Le champ **Rôle est obligatoire** dans les deux formulaires ; le backend accepte les rôles personnalisés (`EmployeeRoles::isAssignable`) et exige `role_id` à la création. Le « licenciement en vidant le rôle » n'existe plus (désactiver/supprimer le compte à la place) | Backend + Frontend |
| 3 | **Onglet Prestations séparé** : l'onglet Packages des pages Produits (pays, agence, département) et du Catalogue (caissier/commercial) ne mélange plus packages et prestations — nouvel onglet **Prestations** à côté | Frontend |
| 4 | **Champs de recherche en select déroulant** : Client, Apprenant, Vendeur, Produit, Agence… s'ouvrent en liste au clic/focus (chevron ▾), avec filtrage à la frappe. Le mode « Nouveau client » (texte libre) de Nouvelle vente est conservé | Frontend |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `frontend-dist.zip` | Build admin du 14/10 (`VITE_API_URL=https://pekegnogroup.com/api`), `.htaccess` inclus | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

**Pas de migration SQL** (aucun changement de schéma), **pas de rebuild `vendor/`**
(`composer.json`/`composer.lock` inchangés — vérifié par diff).

Validé avant livraison : `tsc --noEmit` OK, `php -l` OK (image Docker),
tests `User|Role` : 33 passés. Les 10 échecs Agency pré-existent sans ces
changements (vérifié via `git stash`, liés à l'env d'images).

## 3. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Contrôle base** (boîte SQL → `SELECT` uniquement, rien à importer) :
   ```sql
   SELECT migration FROM migrations ORDER BY id DESC LIMIT 5;  -- dernier lot = 2026_10* (13/10), rien de nouveau attendu
   ```
3. **Code backend** : `git push` fait → cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
4. **Caches** : SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (§3.9), puis **vider l'OPcache** via `reset-opcache.php` (§3.4) et
   **supprimer** le fichier.
5. **Frontend admin** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `14_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`, cf. 01/10). Vérifier `.htaccess` présent (fichiers cachés).
6. Navigateur : **Ctrl+Maj+R**, puis recette ci-dessous.

Retour arrière : repointer le dépôt sur le commit précédent, réuploader
l'ancien build. Aucun changement de schéma : la base est intacte.

## 4. Recette

- [ ] Département Agency → **Équipe client** : la page s'ouvre sans écran « Une erreur est survenue » (affectations + annuaire).
- [ ] **Rôles & Permissions** → créer un rôle test (ex. `superviseur`, quelques permissions) → **Utilisateurs → Créer** : le rôle apparaît dans la liste Rôle ; créer sans rôle → message « Le rôle est obligatoire ».
- [ ] **Utilisateurs → Modifier** un utilisateur : le champ Rôle est obligatoire (impossible de valider vide) ; lui attribuer le rôle test → OK sans erreur 422.
- [ ] Pages **Produits** (pays, agence, département) et **Catalogue** (caissier/commercial) : onglets **Packages** (cartes seules) et **Prestations** (tableau seul) séparés.
- [ ] **Nouvelle vente** → champ **Client** : clic → liste déroulante des clients ; frappe → filtre ; saisie d'un nom inconnu → proposition « Créer… ». Même comportement pour **Vendeur**, **Produit**, et dans **Nouvelle inscription** (**Apprenant**, **Vendeur**).
- [ ] Si le rôle test ne sert plus : le supprimer (Rôles & Permissions) après avoir réassigné ses utilisateurs.
