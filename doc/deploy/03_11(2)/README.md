# Déploiement + recette — 03/11/2026 (2) (fiche commercial : factures liées par dernière activité)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 03/11/2026 (`03_11/`) appliqué**, SQL compris
(commit `0269de9`). S'il n'est pas encore passé : appliquer d'abord `03_11/` (y compris
`repair-accounting-2026-11-03.sql`), puis celui-ci. Le `frontend-dist.zip` de `03_11(2)/`
**remplace** celui de `03_11/` (il contient aussi tous ses changements).

## 1. Ce qui change

Retour après le déploiement de `03_11/` : sur la **fiche d'un commercial** (Commerciaux → Joel
Kameni), la facture `PK-20261022-014` recouvrée le 02/11 n'apparaissait toujours pas dans
« Factures liées », qui n'affichait que les 10 dernières factures **par date de facture**.
(Le recouvrement apparaît bien, lui, dans « Rapport mensuel » → bloc « Recouvrements sur
ventes antérieures » depuis `03_11/`.)

| # | Changement | Partie |
|---|---|---|
| 1 | **Fiche commercial → « Factures liées »** : les 10 factures affichées sont triées par **dernière activité** (date de facture ou date du dernier versement, la plus récente des deux) ; nouvelle colonne **« Dernier versement »** et mention « Les 10 plus récentes par dernière activité… Toutes : « Voir les factures » ». Une facture du mois dernier réglée aujourd'hui remonte en tête | Backend + Frontend |
| 2 | API `GET /api/invoices` : paramètre optionnel `sort=last_activity` (ajoute `last_payment_at` à chaque facture). Sans ce paramètre, tri inchangé (date de facture) : les autres listes de factures ne changent pas | Backend |

| Partie | Action |
|---|---|
| Base de données | **rien** (aucune migration, aucun script) |
| Permissions | aucune |
| Routes | **aucune nouvelle** (vider quand même les caches) |
| `vendor/` | **aucun changement** |
| `.env` | rien |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `frontend-dist.zip` | Build admin du 03/11 (2) (remplace `03_11/frontend-dist.zip`) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `tsc -b` + `vite build` OK, `php -l` OK sur `InvoiceController.php` ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : nouveau test
  `RecoveryPaymentsTest::test_linked_invoices_sorted_by_last_activity_put_recent_recovery_first`
  (tri par défaut inchangé ; avec `sort=last_activity`, la facture du 22/10 recouvrée le 02/11
  passe devant celle du 30/10), **aucun nouvel échec** — les 37 échecs restants sont les échecs
  connus (cf. `CLAUDE.md`).

## 3. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0
   (postérieur à `0269de9`).
2. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : contrôleur PHP modifié) :
   uploader `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
3. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `03_11(2)/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
4. Navigateur : **Ctrl+Maj+R**, puis recette.

Diagnostic :
- Colonne « Dernier versement » présente mais toujours « — » et ordre inchangé → OPcache non vidé
  (étape 2).
- Colonne « Dernier versement » absente → frontend non extrait ou cache navigateur (étapes 3–4).

Retour arrière : repointer le dépôt sur `0269de9`, vider caches + OPcache, réuploader
`03_11/frontend-dist.zip`.

## 4. Recette

- [ ] **Commerciaux → Joel Kameni → Factures liées** : `PK-20261022-014` apparaît parmi les
      premières lignes, « Dernier versement » = 02/11 (« Lundi » / date), date de facture 22/10.
- [ ] Une facture sans versement affiche « — » dans « Dernier versement ».
- [ ] **Voir les factures** (et la page Factures) : ordre habituel par date de facture, inchangé.
- [ ] **Rapport mensuel** (Joel Kameni, novembre) : bloc « Recouvrements sur ventes antérieures »
      toujours présent (lot `03_11/`).
