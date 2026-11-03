# Déploiement + recette — 03/11/2026 (recouvrements dans le rapport commercial, écritures comptables manquantes)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 Importer, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 31/10/2026 (`31_10/`) appliqué**, SQL compris
(dernière migration : `2026_10_31_000001_add_duration_type_to_training_sessions_table`).
S'il n'est pas encore passé : appliquer d'abord `31_10/` (étape 3 de son README), puis celui-ci.
Le `frontend-dist.zip` de `03_11/` **remplace** celui de `31_10/` (il contient aussi tous ses changements).

## 1. Ce qui change

Origine : signalement du 02/11 — « J'ai validé un recouvrement ce matin mais ça ne s'affiche
pas dans mon solde en caisse d'aujourd'hui, ni dans le rapport de vente du commercial »
(facture `PK-20261022-014`, 100 000 OM encaissés le 02/11 par Sandrine Tchangoua).

Analyse du dump prod du 03/11 :
- le versement existe bien (`invoice_payments`) et **est** compté dans le Bilan du jour du 02/11
  (solde de 605 000 calculé à 14h39 = 485 000 de versements valides + 120 000 de 4 factures
  annulées le soir même) ;
- il n'apparaît pas dans « Factures liées » de la fiche commercial parce que cette liste
  n'affiche que les **10 dernières factures par date de facture** (celle-ci date du 22/10) —
  normal, elle est visible via « Voir les factures » ;
- **bug 1** — rapport mensuel du commercial : il ne partait que des factures **émises** dans la
  période ; un reste à payer réglé le mois suivant n'apparaissait dans **aucune** période ;
- **bug 2** — comptabilité : un 2e versement du **même montant** que le 1er était pris pour un
  doublon et n'avait pas d'écriture comptable (2 cas en prod, 130 000 FCFA).

| # | Changement | Partie |
|---|---|---|
| 1 | **Rapport commercial mensuel** (Commerciaux → Rapport mensuel) : nouveau bloc **« Recouvrements sur ventes antérieures »** dans chaque volet (Académie / Agency) — versements encaissés dans la période sur des factures du commercial émises **avant** la période (date, facture, date facture, client, activité, montant) — et KPI **« Recouvrements (ventes antérieures) »** quand il y en a. Le facturé, l'encaissé et le taux d'encaissement des ventes de la période ne changent pas | Backend + Frontend |
| 2 | **Comptabilité** : chaque versement a désormais son écriture « Facture … — versement », même s'il a le même montant qu'un versement précédent de la facture (`AccountingService::recordIncomeFromPayment`) | Backend |
| 3 | **Rattrapage** des 2 écritures manquantes (`PK-20261022-014` : 100 000 ; `PK-20261031-001` : 30 000, toutes deux du 02/11) | Base (données) |
| 4 | **Validations unifiées** (commit collègue `aa7f48c`, déjà sur `master`) : page « Validations » avec onglets « Factures en attente » / « Preuves de paiement », bandeau des preuves en attente, filtre `department_id` sur `/api/payment-proofs` | Backend + Frontend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration** ; 1 script de données → `repair-accounting-2026-11-03.sql` |
| Permissions | aucune |
| Routes | **aucune nouvelle** (vider quand même les caches) |
| `vendor/` | **aucun changement** |
| `.env` | rien |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `repair-accounting-2026-11-03.sql` | Crée les écritures comptables manquantes des versements de même montant (générique : rattrape aussi un cas apparu après le dump) | Importer **après** le `git pull` (étape 3) |
| `frontend-dist.zip` | Build admin du 03/11, inclut le commit `aa7f48c` (remplace `31_10/frontend-dist.zip`) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `repair-accounting-2026-11-03.sql` importé **2 fois de suite** sur un vrai **PostgreSQL 9.6**
  chargé avec les données du dump prod du 03/11 : 1er passage `INSERT 0 2` (exactement
  `PK-20261022-014` 100 000 du 02/11 et `PK-20261031-001` 30 000 du 02/11, même département /
  catégorie que l'écriture existante de la facture), au rejeu `INSERT 0 0` ;
- `tsc -b` + `vite build` OK ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : 534 OK dont 2 nouveaux
  (`RecoveryPaymentsTest`), **aucun nouvel échec** — les 37 échecs restants sont les échecs
  connus (cf. `CLAUDE.md`).

## 3. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0
   (postérieur à `aa7f48c`, le commit « unifie les validations » du collègue).
3. **Base** : phpPgAdmin → base → onglet **Importer** → `03_11/repair-accounting-2026-11-03.sql`.
   Attendu : `BEGIN`, `LOCK TABLE`, `INSERT 0 2` (ou plus si d'autres cas sont apparus depuis le
   03/11), `COMMIT` ; au rejeu : `INSERT 0 0`.
   À faire **après** l'étape 2 (sinon un versement de même montant encaissé entre-temps resterait
   sans écriture — rejouer le script suffit à le rattraper).
4. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : services PHP modifiés) :
   uploader `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
5. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `03_11/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
6. Navigateur : **Ctrl+Maj+R**, puis recette.

Contrôles (boîte SQL → `SELECT` uniquement) :
```sql
SELECT number, reference, amount, transacted_at FROM accounting_transactions
WHERE reference IN ('PK-20261022-014', 'PK-20261031-001') ORDER BY reference, transacted_at;
  -- 4 lignes : 100 000 (22/10) + 100 000 (02/11) ; 30 000 (31/10) + 30 000 (02/11)
```

Diagnostic :
- Pas de bloc « Recouvrements » dans le rapport mensuel de novembre de Joel Kameni → OPcache non
  vidé (étape 4) ou frontend non extrait / cache navigateur (étapes 5–6).
- Un nouveau 2e versement de même montant sans écriture comptable → OPcache non vidé (étape 4) ;
  rejouer ensuite le script SQL pour le rattraper.

Retour arrière : repointer le dépôt sur `aa7f48c` (garde les validations unifiées) ou `cd1bcad`, vider caches + OPcache, réuploader
`31_10/frontend-dist.zip`. Les écritures créées par le script sont justes (elles correspondent à
de vrais versements) et peuvent rester.

## 4. Recette

- [ ] **Commerciaux → Rapport mensuel** → Joel Kameni, période **novembre 2026** : bloc
      « Recouvrements sur ventes antérieures » avec `PK-20261022-014` — 02/11/2026 — facture du
      22/10/2026 — ABIGAEL MAGUTE NZONDA — 100 000 FCFA ; KPI « Recouvrements (ventes antérieures) ».
- [ ] Même rapport, période **octobre 2026** : pas de bloc Recouvrements pour cette facture ;
      facturé / encaissé / taux inchangés par rapport à avant le déploiement.
- [ ] **Impression** du rapport mensuel : le bloc Recouvrements apparaît dans la feuille imprimée.
- [ ] **Comptabilité** (Douala) : écritures « Facture PK-20261022-014 — versement » ×2 et
      « Facture PK-20261031-001 — versement » ×2.
- [ ] Encaisser sur une facture de test **deux versements du même montant** → deux écritures
      comptables (puis annuler la facture de test).
- [ ] **Validations** (caissier et admin) : onglets « Factures en attente » / « Preuves de paiement », bandeau des preuves en attente.
- [ ] **Recette du lot `31_10/`** s'il n'était pas encore passé.
