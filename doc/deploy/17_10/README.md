# Déploiement + recette — 17/10/2026 (paiement du reste + preuve de paiement + espace formateur)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(pièges §3.1 → §3.9 — relire avant d'agir, surtout §3.2 Importer,
§3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 16/10/2026 appliqué** (`16_10/`).
Si le 16/10 n'est pas encore passé en prod, l'appliquer **d'abord**
(voir `16_10/README.md`), puis enchaîner celui-ci.

## 1. Ce qui change (code poussé sur GitHub, branche `master`)

| # | Changement | Partie |
|---|---|---|
| 1 | **Preuve de paiement : montant du reste à payer** — colonne `amount` ajoutée à `payment_proofs`. Le commercial peut désormais transmettre le montant du reste à payer (pas seulement l'avance déclarée) avec une preuve. | Backend + Base |
| 2 | **Régler le reste à payer** (`POST /invoices/{id}/pay-remaining`) : le commercial soumet montant + mode de paiement + preuve. La preuve reste en attente d'examen par le caissier. À l'acceptation, le montant est encaissé automatiquement (reçu, trésorerie, comptabilité, commissions). | Backend |
| 3 | **File de validation des preuves** (`/invoices/payment-proofs`) : le caissier / responsable accepte ou rejette chaque preuve (motif obligatoire au rejet). Accepter valide la facture et encaisse ; rejeter rejette la facture. | Backend + Frontend |
| 4 | **Nouvelle page `PaymentProofsPage`** : liste paginée des preuves avec filtres (statut, facture, agence, pays), boutons Accepter / Rejeter. Ajoutée au menu (icône Receipt) pour super-admin, direction, responsable-agence, caissier. | Frontend |
| 5 | **Impression reçus partiels** (`InvoiceDetailPage`) : une facture partiellement soldée n'est plus bloquée à l'impression — chaque versement a son reçu imprimable (numéro REC-, montant en lettres, reste à payer). | Frontend |
| 6 | **Refonte espace formateur** : `TrainerDashboardPage` remplacé par pages dédiées (`TrainerOverviewPage`, `TrainerCoursesPage`, `TrainerLearnersPage`, `TrainerSessionsPage`, `TrainerPlanningPage`) + `TrainerLayout`. Routage mis à jour. | Frontend |
| 7 | Divers ajustements : `ServiceListPage` (packages/prestations séparés), `PrestationFormModal`, `router` (routes `/invoices/payment-proofs`), `ContextBar`. | Frontend |

**Permissions : aucun changement nécessaire.** Les nouvelles routes utilisent
`invoices.creer` (upload preuve staff), `invoices.consulter` (liste preuves),
`invoices.valider` (accepter/rejet) — toutes déjà dans le seed de septembre
(accordées à responsable-agence, responsable-departement, comptable, caissier).
**Pas de `seed-permissions-2026-10-17.sql`.**

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-10-17.sql` | Colonne `amount` sur `payment_proofs` + ligne `migrations` (données seules, **aucun changement de schéma lourd**) | Importer **en 1er** |
| `frontend-dist.zip` | Build admin du 17/10 (`VITE_API_URL=https://pekegnogroup.com/api`), `.htaccess` inclus | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

**Pas de rebuild `vendor/`** (`composer.json`/`composer.lock` inchangés —
vérifié par diff).

Validé avant livraison : `tsc --noEmit` OK, `php -l` OK,
`migration-2026-10-17.sql` rejouable sans erreur (`ADD COLUMN IF NOT EXISTS` +
`INSERT ... WHERE NOT EXISTS`).

## 3. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Base** : phpPgAdmin → base → onglet **Importer** →
   `17_10/migration-2026-10-17.sql`. Attendu : succès (`ALTER TABLE`,
   `INSERT 0 1`, ou `INSERT 0 0` si rejoué).
3. **Contrôles** (boîte SQL → `SELECT` uniquement) :
   ```sql
   SELECT column_name FROM information_schema.columns
     WHERE table_name = 'payment_proofs' AND column_name = 'amount';  -- 1 ligne attendue
   SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;  -- la 2026_10_17 en tête
   ```
4. **Code backend** : `git push` fait → cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
5. **Caches** : SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (§3.9), puis **vider l'OPcache** via `reset-opcache.php` (§3.4) et
   **supprimer** le fichier.
6. **Frontend admin** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `17_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (fichiers cachés).
7. Navigateur : **Ctrl+Maj+R**, puis recette ci-dessous.

Retour arrière : restaurer la sauvegarde (1), repointer le dépôt sur le commit
précédent, réuploader l'ancien build. La nouvelle colonne est sans effet sur
l'ancien code.

## 4. Recette

- [ ] **Super-admin / responsable-agence / caissier** → menu « Paiements à
  valider » (icône Receipt) : la page `/invoices/payment-proofs` s'ouvre sans erreur.
- [ ] **Commercial** → une facture partielle (payée en partie) : bouton « Payer le
  reste » → saisie montant + mode + preuve → règlement transmis au caissier.
- [ ] **Caissier** → `/invoices/payment-proofs` : la preuve apparaît en attente ;
  bouton **Accepter** → la facture est validée, le montant encaissé, le reçu
  généré ; bouton **Rejeter** (motif obligatoire) → facture rejetée.
- [ ] **Facture partielle** → « Imprimer » : chaque versement a son reçu
  imprimable (numéro REC-AAAAMMJJ-NNN, montant en chiffres et lettres, reste à
  payer).
- [ ] **Formateur** → connexion : arrive sur son espace formateur avec formations,
  apprenants, sessions et planning (pages dédiées, plus de `TrainerDashboardPage`
  monolithe).
- [ ] **Navigateur** : couper le Wi-Fi, cliquer sur une page jamais visitée → écran
  « Connexion perdue » ; remettre le Wi-Fi → la page se recharge seule.

## 5. Fichiers déjà préparés dans `doc/deploy/` (rappel)

| Fichier | Usage |
|---|---|
| `reset-transactions.sql` | Remet à zéro toutes les transactions (factures, paiements, dépenses…) en conservant la configuration — **sauvegarde obligatoire avant** |
| `reset-prod-fresh-2026-10-16.sql` | Remise à neuf complète : ne garde que `admin@pekegno.com` + `admin2@pekegno.com` (`12345678`) — **sauvegarde obligatoire avant** |
| `seed-admin.sql` / `seed-admin2.sql` | Crée les comptes super-admin (à importer après remise à neuf si besoin) |
| `fix-permissions.sql` | Corrige les droits après import de schéma (piège §3.3) |
