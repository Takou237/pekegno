# Déploiement + recette — 03/11/2026 (3) (Community Manager vendeur + tableau de bord ; KPI encaissé total)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 import SQL, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot du 03/11/2026 (2) (`03_11(2)/`) appliqué**. S'il n'est pas encore
passé : appliquer d'abord `03_11/` (SQL compris) puis `03_11(2)/`, puis celui-ci. Le
`frontend-dist.zip` de `03_11(3)/` **remplace** ceux de `03_11/` et `03_11(2)/` (il contient
tous leurs changements).

## 1. Ce qui change

| # | Changement | Partie |
|---|---|---|
| 1 | **Community Manager = fonctionnalités de vente du commercial en plus de « Mon suivi »**. Menu : Tableau de bord, Clients, Mon suivi, Factures, Catalogue (**avec les onglets Packages et Prestations**), Mon profil. **Pas** de Prospects, Commissions, Rapport mensuel ni Suivi des ventes dans son menu. Vente rapide / facture / souscription package & prestation / inscription formation à son nom, preuve de paiement obligatoire, ventes en attente de validation (caissier) | Backend + Frontend |
| 2 | **Tableau de bord du Community Manager** (`/commercial/dashboard`, page d'accueil) : KPI CA, Ventes, Mes prestations, Mes actions à faire ; « Mes prochaines actions » (lien vers Mon suivi) ; factures récentes ; ses prestations | Frontend |
| 3 | Périmètre du Community Manager = celui du commercial : ses factures, ses ventes. **Prestations** : celles qu'il a vendues **+** celles dont il est équipier / a une action | Backend |
| 4 | **Fiche vendeur créée à la volée** (commercial ou Community Manager sans fiche) : à l'ouverture du tableau de bord / Mon profil (fin de « Aucun profil commercial associé à votre compte » et « Impossible de charger les commerciaux »), à la connexion, à une vente ou une inscription. À sa création, ses ventes déjà saisies sans fiche (vendeur = ce compte) lui sont rattachées | Backend |
| 5 | **Factures** (commercial et Community Manager) : affiche aussi les ventes dont il est vendeur / créateur, même sans fiche vendeur rattachée (avant : liste vide) | Backend |
| 6 | Permissions : le rôle `community-manager` reçoit toutes les permissions du rôle `commercial` (migration `2026_11_03_000001`, rien n'est retiré) | Base |
| 7 | **Rapport mensuel (écran + impression)** : « Recouvrements (ventes antérieures) » **toujours affiché** (même à 0), suivi du nouveau KPI **« Total encaissé sur la période (ventes + recouvrements) »** = Total encaissé + Recouvrements. Ex. 01/11 → 30/11 : 250 000 + 145 000 = **395 000**. KPI sur 3 colonnes | Frontend |

| Partie | Action |
|---|---|
| Base de données | `migration-2026-11-03.sql` (permissions seules, aucun changement de schéma) |
| Permissions | +permissions du commercial → `community-manager` |
| Routes | **aucune nouvelle** (vider quand même les caches) |
| `vendor/` | **aucun changement** |
| `.env` | rien |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-11-03.sql` | Permissions du commercial → community-manager + ligne `migrations` (rejouable, une transaction) | phpPgAdmin → **Importer**, juste après le `git pull` |
| `frontend-dist.zip` | Build admin du 03/11 (3) (remplace `03_11/` et `03_11(2)/`) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `tsc -b` + `vite build` OK, `php -l` OK sur les fichiers PHP modifiés ;
- `migration-2026-11-03.sql` rejoué **deux fois** sur un conteneur PostgreSQL 9.6 (aucune erreur,
  aucun doublon) ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : 537 OK dont le nouveau
  `CommunityManagerSalesTest` (Community Manager sans fiche : voit ses factures, pas celles des
  autres ; `/commercials/me/stats` crée la fiche et lui rattache sa vente ; il a toutes les
  permissions du commercial). **Aucun nouvel échec** — les 37 échecs restants sont les échecs
  connus (cf. `CLAUDE.md`) ;
- migration jouée sur la base locale : community-manager = 51 permissions.

## 3. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot et
   `git push` sur `master`. Noter le hash du commit obtenu.
1. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0.
2. **Base** : phpPgAdmin → base `sc1fopa5058_pekegno` → onglet **Importer** →
   `migration-2026-11-03.sql`. Contrôle (boîte SQL, SELECT seul) :
   `SELECT migration FROM migrations WHERE migration LIKE '2026_11_03%';` → 1 ligne.
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : plusieurs fichiers PHP modifiés) :
   uploader `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `03_11(3)/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
5. Les Community Managers déjà connectés doivent **se déconnecter / reconnecter**
   (les permissions sont chargées à la connexion), puis **Ctrl+Maj+R**.

Diagnostic :
- Menu du Community Manager réduit à « Mon suivi » → frontend non extrait ou cache navigateur (étapes 4–5).
- « Aucun profil commercial associé à votre compte » sur le tableau de bord → OPcache non vidé (étape 3).
- Menu complet mais pages « accès non autorisé » / listes vides → SQL non importé (étape 2) ou
  utilisateur non reconnecté (étape 5).
- Le Community Manager voit les factures de tout le monde → OPcache non vidé (étape 3).
- KPI « Recouvrements » / « Total encaissé sur la période » absents → frontend (étapes 4–5).

Retour arrière : repointer le dépôt sur le commit du lot `03_11(2)`, vider caches + OPcache,
réuploader `03_11(2)/frontend-dist.zip`. Les permissions ajoutées peuvent rester (sans effet
visible avec l'ancien frontend, hormis l'accès API).

## 4. Recette

Community Manager (ex. compte « TEST 2 ») :
- [ ] Connexion → arrive sur **son tableau de bord** : KPI CA / Ventes / Mes prestations / Mes
      actions à faire, « Mes prochaines actions », factures récentes, ses prestations.
- [ ] Menu : Tableau de bord, Clients, Mon suivi, Factures, Catalogue, Mon profil —
      **sans** Prospects, Commissions, Rapport mensuel, Suivi des ventes.
- [ ] **Mon profil** : sa fiche s'affiche (plus de « Impossible de charger les commerciaux »).
- [ ] **Vente rapide** / **Nouvelle facture** / **inscription formation** : à son nom, preuve de
      paiement exigée, facture **en attente de validation** côté caissier, visible dans **Factures**.
- [ ] **Factures** : ne voit que ses propres factures ; peut annuler une facture en attente à lui.
- [ ] **Catalogue** : onglets Services, Académie, **Packages** et **Prestations** ; souscrire un
      package / une prestation depuis ces onglets (vendeur = lui-même).
- [ ] **Mon suivi** : les prestations dont il est équipier et ses actions restent visibles.

Rapport mensuel (n'importe quel commercial, période 01/11 → 30/11) :
- [ ] « Recouvrements (ventes antérieures) » toujours affiché (0 FCFA s'il n'y en a pas), suivi de
      **« Total encaissé sur la période (ventes + recouvrements) »** = « Total encaissé » +
      « Recouvrements » (ex. 250 000 + 145 000 = 395 000). Idem sur la version imprimée.

Non-régression :
- [ ] Un **commercial** garde exactement le même menu et tableau de bord.
- [ ] Un **caissier** valide la facture en attente du Community Manager (preuve acceptée).
