# Déploiement + recette — 31/10/2026 (type de durée des sessions, heure et détail des sessions)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 30/10/2026 (2) (`30_10(2)/`) appliqué**, SQL compris
(dernière migration : `2026_10_30_000003_grant_session_delete_to_department_chief`).
S'il n'est pas encore passé : importer d'abord `30_10(2)/migration-2026-10-30.sql`
(étape 3 de son README), puis celui-ci. Le `frontend-dist.zip` de `31_10/`
**remplace** celui de `30_10(2)/` (il contient aussi tous ses changements).

## 1. Ce qui change

Code : commit `1ccf1d3` (déjà sur GitHub `master`) + les modifications locales de ce lot
(et le point 8 « Responsive » du lot `30_10(2)/`, pas encore commité) — **à commiter et
pousser sur `master` avant le déploiement** (§3, étape 0).

| # | Changement | Partie |
|---|---|---|
| 1 | **Type de durée des sessions** (Limitée / Illimitée), comme sur les formations, dans les deux formulaires « Nouvelle session » (page Sessions et fiche d'une formation) et dans « Modifier la session ». **Illimitée** : seul « Début » est affiché, la session n'a pas de date de fin ; **Limitée** : « Fin » apparaît. Le type d'une session existante est modifiable (passer en Illimitée efface la date de fin). Sessions existantes : **Limitée** si elles ont une date de fin, sinon **Illimitée** | Backend + Frontend + Base |
| 2 | **Heure des sessions** : le choix de la session dans « Nouvelle inscription » affiche la date **et l'heure** (ex. « Session — 29/10/2026 19:45 (3/20) ») ; la fiche d'une formation affiche aussi l'heure de ses sessions (« Illimitée » quand il n'y a pas de fin) | Frontend |
| 3 | **Détail de la session choisie** dans les formulaires d'inscription (« Nouvelle inscription », fiche d'une formation, page Apprenants) : dès qu'une session est sélectionnée, un encadré affiche son statut, son début et sa fin (date + heure, ou « Illimitée »), son formateur et ses places (inscrits / capacité, places restantes) | Frontend |

| Partie | Action |
|---|---|
| Base de données | **1 migration** → `migration-2026-10-31.sql` (`training_sessions.duration_type`) |
| Permissions | aucune |
| Routes | **aucune nouvelle** (vider quand même les caches) |
| `vendor/` | **aucun changement** |
| `.env` | rien |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-10-31.sql` | Migration `2026_10_31_000001_add_duration_type_to_training_sessions_table` : colonne `duration_type` (défaut `unlimited`), sessions avec date de fin → `limited`, + ligne `migrations` | Importer **juste après** le `git pull` |
| `frontend-dist.zip` | Build admin du 31/10 (remplace `30_10(2)/frontend-dist.zip`) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `migration-2026-10-31.sql` importé **2 fois de suite** sur un vrai **PostgreSQL 9.6** :
  1er passage `ALTER TABLE`, `UPDATE 1`, `INSERT 0 1`, `COMMIT` ; au rejeu
  `NOTICE … already exists, skipping`, `UPDATE 0`, `INSERT 0 0` ; données conformes ;
- `tsc` + build OK, `php -l` OK sur les fichiers PHP modifiés ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : 532 OK, **aucun nouvel échec** —
  les 37 échecs restants sont les échecs connus (cf. `CLAUDE.md`).

## 3. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0
   (postérieur à `1ccf1d3`).
3. **Base** : phpPgAdmin → base → onglet **Importer** → `31_10/migration-2026-10-31.sql`.
   Attendu : `ALTER TABLE`, `UPDATE n`, `INSERT 0 1`, `COMMIT`
   (au rejeu : `NOTICE … already exists, skipping`, `UPDATE 0`, `INSERT 0 0`).
   ⚠️ À faire **juste après** l'étape 2 : le nouveau code lit `training_sessions.duration_type`
   (sans la colonne, création / modification / affichage des sessions en erreur).
4. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : contrôleur, requêtes, ressource et modèle PHP modifiés) :
   uploader `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
5. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `31_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
6. Navigateur : **Ctrl+Maj+R**, puis recette.

Contrôles (boîte SQL → `SELECT` uniquement) :
```sql
SELECT migration FROM migrations WHERE migration LIKE '2026_10_31%';  -- 1 ligne
SELECT duration_type, COUNT(*), COUNT(end_at) FROM training_sessions GROUP BY 1;
  -- 'unlimited' : COUNT(end_at) = 0 ; 'limited' : sessions avec date de fin
```

Diagnostic :
- Erreur SQL « column duration_type does not exist » → SQL non importé (étape 3).
- Champ « Type de durée » absent du formulaire → frontend non extrait ou cache navigateur (étapes 5–6).
- Session enregistrée « Illimitée » qui garde sa date de fin → OPcache non vidé (étape 4).

Retour arrière : repointer le dépôt sur `1ccf1d3`, vider caches + OPcache, réuploader
`30_10(2)/frontend-dist.zip`. La colonne `duration_type` peut rester (ignorée par l'ancien
code) ; pour la retirer : `ALTER TABLE training_sessions DROP COLUMN IF EXISTS duration_type;`
puis `DELETE FROM migrations WHERE migration = '2026_10_31_000001_add_duration_type_to_training_sessions_table';`
(via l'onglet Importer).

## 4. Recette

- [ ] **Sessions → Nouvelle session** : champ « Type de durée » présent ; **Illimitée** → seul « Début » visible ; **Limitée** → « Fin » apparaît ; session créée avec le bon type.
- [ ] **Fiche d'une formation → Nouvelle session** (Formateur, Début, Fin, Capacité max) : même champ « Type de durée », même comportement.
- [ ] **Modifier une session** limitée → passer en **Illimitée** → enregistrer → plus de date de fin dans la liste ; repasser en Limitée avec une fin → la fin s'affiche.
- [ ] **Sessions existantes** (créées avant le lot) : celles avec une date de fin s'ouvrent en « Limitée », les autres en « Illimitée ».
- [ ] **Nouvelle inscription** (formation avec sessions) → liste « Session » : date **et heure** affichées (ex. `Session — 29/10/2026 19:45`).
- [ ] **Nouvelle inscription** (et fiche d'une formation → Inscrire, Apprenants → inscription) → choisir une session → encadré avec statut, Début, Fin (ou « Illimitée »), Formateur, Inscrits / capacité et places restantes ; pas d'agence affichée ; l'encadré disparaît si on revient à « Sélectionner une session ».
- [ ] **Fiche d'une formation** → liste des sessions : heure affichée, « Illimitée » pour une session sans fin.
- [ ] **Recette du lot `30_10(2)/`** s'il n'était pas encore passé.
