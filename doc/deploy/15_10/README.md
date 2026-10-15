# Déploiement + recette — 15/10/2026 (parité chefs : agence + département)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(pièges §3.1 → §3.9 — relire avant d'agir, surtout §3.2 Importer,
§3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 14/10/2026 appliqué** (`14_10/`).
Si le 14/10 n'est pas encore passé en prod, l'appliquer **d'abord**
(voir `14_10/README.md`), puis enchaîner celui-ci.

## 1. Ce qui change (code poussé sur GitHub, branche `master`)

Le responsable d'agence entre par **son agence** (redirigé au login vers
`/countries/…/agencies/…`, comme l'admin) et y a **tous les pouvoirs de
l'admin** ; idem pour le chef de département avec **son département**.

| # | Changement | Partie |
|---|---|---|
| 1 | Connexion responsable-agence → son agence ; chef de département → son département (repli : listes Mes agences / Mes départements) | Frontend |
| 2 | Pouvoirs financiers : **encaisser** factures, **supprimer** dépenses / commissions / écritures et catégories comptables / services-produits-catégories, **trésorerie** de son périmètre (lecture + transferts), **ajuster les points** des commerciaux | Backend + Frontend + SQL |
| 3 | Équipe : créer, assigner, retirer, **reset password** (comptes non-admin du périmètre) ; le chef d'agence **nomme le chef** de sa propre agence | Backend + Frontend |
| 4 | Chef de département : crée des comptes (rattachés à son département), édite son département, pastille impayés, bouton « + » global | Backend + Frontend |
| 5 | Correctifs au passage : `RoleController::destroy` n'autorisait que les rôles système (dont `client` !) ; `DepartmentController` show/update/destroy sans autorisation ; listes départements/utilisateurs alignées sur tout le périmètre (plus seulement la primaire) ; `DepartmentPolicy` voit le chef de département | Backend |

**Volontairement exclus** (hors périmètre / structure) : créer-supprimer des
agences et départements, rôles & permissions, réglages globaux, audit,
corbeilles (restauration = direction). Le dire s'il les faut aussi.

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `seed-permissions-chefs-2026-10-15.sql` | 14 grants responsable-agence + 25 grants responsable-departement (miroir `RoleSeeder`, rejouable) | Importer **en 1er** |
| `frontend-dist.zip` | Build admin du 15/10 (`VITE_API_URL=https://pekegnogroup.com/api`), `.htaccess` inclus | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

**Pas de migration de schéma**, **pas de rebuild `vendor/`**
(`composer.json`/`composer.lock` inchangés — vérifié par diff).

Validé avant livraison : `tsc --noEmit` OK, `php -l` OK (image Docker),
tests `User|Role|Department` : 57 passés, 3 échecs pré-existants
(`AgencyDepartmentTest`, vérifiés sans ces changements via `git stash`).

## 3. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Base — droits** : phpPgAdmin → base → onglet **Importer** →
   `15_10/seed-permissions-chefs-2026-10-15.sql`. Attendu : succès
   (`INSERT 0 1` / `INSERT 0 0` si rejoué).
3. **Contrôles** (boîte SQL → `SELECT` uniquement) :
   ```sql
   SELECT count(*) FROM role_permission rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
     WHERE r.name = 'responsable-agence'
     AND p.name IN ('invoices.encaisser', 'tresories.consulter', 'tresories.modifier', 'comptabilite.supprimer', 'depenses.supprimer', 'commissions.supprimer');  -- attendu : 6
   SELECT count(*) FROM role_permission rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
     WHERE r.name = 'responsable-departement'
     AND p.name IN ('invoices.encaisser', 'tresories.consulter', 'comptabilite.supprimer', 'bilans.consulter', 'depenses.supprimer', 'commissions.supprimer');  -- attendu : 6
   ```
4. **Code backend** : `git push` fait → cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
5. **Caches** : SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (§3.9), puis **vider l'OPcache** via `reset-opcache.php` (§3.4) et
   **supprimer** le fichier.
6. **Frontend admin** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `15_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (fichiers cachés).
7. Navigateur : **Ctrl+Maj+R**, puis recette ci-dessous.

Retour arrière : restaurer la sauvegarde (1), repointer le dépôt sur le commit
précédent, réuploader l'ancien build. Les nouvelles lignes `role_permission`
sont sans effet sur l'ancien code.

## 4. Recette (connecté en responsable-agence, puis chef de département)

- [ ] Connexion → arrive **directement sur son agence** (vue d'ensemble), pas sur le dashboard global.
- [ ] Menu agence complet : départements, services, academy, commerciaux, employés, factures, validations, créances, comptabilité, bilans, équipes, paramètres. Pastille impayés sur Factures. Bouton **+** visible dans l'en-tête.
- [ ] Facture → **Encaisser** possible ; dépense → **supprimer** possible ; **Trésorerie** : comptes et mouvements de son agence + transfert entre ses comptes.
- [ ] Commerciaux → **ajuster les points** d'un commercial de son agence.
- [ ] Équipes → créer, assigner un existant, retirer, **reset password** ; Paramètres → **nommer le chef** de sa propre agence.
- [ ] Chef de département : connexion → arrive sur **son département** ; crée un utilisateur (rattaché auto à son département) ; édite son département.
- [ ] Garde-fous : un chef ne voit que son périmètre (agences/départements assignés) ; reset/suppression d'un compte direction ou super-admin refusé.
