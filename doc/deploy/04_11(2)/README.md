# Déploiement + recette — 04/11/2026 (2) (inscription à la validation de la facture, espace formateur « Mes formations », présences, preuve de paiement)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 import SQL, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot `04_11/` appliqué** (API sur `https://api.plateforme.pekegnogroup.com`,
SSL actif). S'il n'est pas encore passé : appliquer d'abord `03_11(3)/`, puis `api-subdomain/`
(étapes 1 à 4), puis `04_11/`, puis celui-ci. Le `frontend-dist.zip` de ce dossier **remplace**
celui de `04_11/` (même URL d'API, il contient tous ses changements).

## 1. Ce qui change

| # | Changement | Partie |
|---|---|---|
| 1 | **Inscription effective seulement à la validation de la facture.** Facture en attente (commercial, community manager, chef d'agence / de département, inscription en ligne du client) → inscription **« En attente de validation »** (badge orange), **aucune place en session** ; la session choisie est mémorisée. Validation (bouton Valider ou preuve acceptée) → **Inscrit** + affectation à la session. Vente d'un caissier / admin → inscrit tout de suite (inchangé) | Backend + Frontend |
| 2 | **Facture annulée ou rejetée** (y compris preuve rejetée) → l'inscription liée passe **Annulé** ; le **client créé pendant la vente** est supprimé (suppression logique, email libéré) s'il n'a aucune autre activité. Un client existant n'est jamais touché | Backend |
| 3 | Une inscription en attente ne peut qu'être **annulée** à la main (pas forcée en « Inscrit ») ; elle n'est pas comptée dans les effectifs (formations, formateurs, rapports Académie) | Backend + Frontend |
| 4 | **Preuve de paiement obligatoire pour le chef de département** (vente rapide, facture, inscription, souscription) comme pour le chef d'agence | Backend + Frontend |
| 5 | **« Nouvelle inscription » de la page Apprenants** (département / agence) : champs **Moyen de paiement** + **Preuve de paiement** (obligatoire pour commercial, community manager, chefs) | Frontend |
| 6 | **Tableau de bord formateur corrigé** : sessions, inscriptions, apprenants formés et revenus calculés sur les **participants de SES sessions** (avant : toutes les inscriptions de la formation → ex. 2 inscrits affichés pour une session à 0). Onglets **Sessions** et **Planning** : **toutes** les sessions (avant : 5 max), compteur « Sessions à venir » exact | Backend + Frontend |
| 7 | **Fiche apprenant** ouvrable depuis l'onglet Apprenants de l'espace formateur (lecture seule, limitée à ses sessions) ; liste des apprenants = ceux de ses sessions, quelle que soit l'agence | Backend + Frontend |
| 8 | **« Mes formations »** (menu) pour un **commercial / community manager lié à un profil formateur** (« Compte lié » de la fiche formateur) : onglets Tableau de bord, Formations, Apprenants, Sessions, Planning. Plus de création automatique de profil formateur pour un non-formateur | Backend + Frontend |
| 9 | **Feuille de présence** depuis les tableaux de sessions de l'espace formateur et de « Mes formations ». Le **formateur de la session** peut enregistrer les présences, même sans la permission `presences.modifier` (commercial / CM formateur) — uniquement sur ses sessions | Backend + Frontend |
| 10 | **« Nouvelle formation »** : plus de message « Vous n'avez pas les droits nécessaires » pour le chef de département (liste des pays lue depuis le catalogue public) ; il peut toujours déployer dans d'autres pays. **Seul le pays courant est pré-coché**, les autres se cochent à la main (création rapide « + » au niveau groupe : tous cochés, inchangé) | Frontend |

| Partie | Action |
|---|---|
| Base de données | `migration-2026-11-04.sql` : 3 colonnes (`users.deleted_at`, `invoices.client_was_created`, `formation_enrollments.requested_session_id`) + lignes `migrations`. **Aucune permission** |
| Routes | **aucune nouvelle**, middleware de `PUT /api/training-sessions/{id}/attendances` modifié → **vider le cache de routes** |
| `vendor/` | **aucun changement** |
| `.env` | rien |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://api.plateforme.pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié (le client voit son inscription en ligne « En attente » jusqu'à l'acceptation de sa preuve) |

⚠️ **Ordre critique** : le code utilise `users.deleted_at` sur toutes les requêtes utilisateurs
(connexion comprise). Entre le `git pull` (étape 1) et l'import SQL (étape 2), **personne ne peut
se connecter** (erreur `column users.deleted_at does not exist`). Enchaîner les étapes 1 et 2
sans attendre.

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-11-04.sql` | 3 migrations de schéma + lignes `migrations` (rejouable, une transaction) | phpPgAdmin → **Importer**, **juste après** le `git pull` |
| `frontend-dist.zip` | Build admin du 04/11 (2) (remplace `04_11/`) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `tsc -b` + `vite build` OK ; `https://api.plateforme.pekegnogroup.com/api` est la seule URL d'API
  du bundle ;
- `migration-2026-11-04.sql` rejoué **deux fois** sur un conteneur PostgreSQL 9.6.24 (aucune
  erreur, aucun doublon dans `migrations`) ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : **551 OK**, dont les nouveaux
  `EnrollmentPendingUntilInvoiceValidatedTest` (8) et `LinkedTrainerSpaceTest` (6). **Aucun nouvel
  échec** — les 37 échecs restants sont les échecs connus (cf. `CLAUDE.md`).

## 3. Déploiement (dans cet ordre)

0. **(Local) Pousser le code** : commiter les modifications de ce lot (code backend + frontend +
   ce dossier) et `git push` sur `master`. Noter le hash du commit obtenu.
1. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0.
2. **Base (immédiatement)** : phpPgAdmin → base `sc1fopa5058_pekegno` → onglet **Importer** →
   `migration-2026-11-04.sql`. Contrôle (boîte SQL, SELECT seul) :
   `SELECT migration FROM migrations WHERE migration > '2026_11_03_000001' ORDER BY migration;`
   → 3 lignes.
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** (obligatoire : nombreux fichiers PHP modifiés) :
   uploader `doc/deploy/reset-opcache.php` dans `backend/public/`, ouvrir
   `https://api.plateforme.pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec succès »
   → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `04_11(2)/frontend-dist.zip` → **Extraire** en écrasant (garder les anciens
   `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
5. Les utilisateurs déjà connectés doivent **se déconnecter / reconnecter** (l'entrée
   « Mes formations » dépend des infos chargées à la connexion), puis **Ctrl+Maj+R**.

Diagnostic :
- « column users.deleted_at does not exist » à la connexion → SQL non importé (étape 2).
- « column … requested_session_id / client_was_created does not exist » à une inscription / vente → idem.
- Une inscription d'un commercial apparaît « Inscrit » au lieu de « En attente » → OPcache non vidé (étape 3).
- Badge « En attente de validation », « Mes formations », lien « Feuille de présence » absents →
  frontend non extrait ou cache navigateur (étapes 4–5).
- « Mes formations » absent pour un commercial / CM formateur → vérifier le « Compte lié » sur sa
  fiche formateur, puis déconnexion / reconnexion.
- Formateur commercial / CM : « 403 » en enregistrant les présences → cache de routes / OPcache (étape 3).

Retour arrière : repointer le dépôt sur le commit `be8f057` (lot `04_11`), vider caches + OPcache,
réuploader `04_11/frontend-dist.zip`. Les 3 colonnes ajoutées peuvent rester (ignorées par
l'ancien code).

## 4. Recette

Inscription soumise à validation (compte commercial, CM ou chef de département) :
- [ ] Nouvelle inscription avec avance + preuve (+ session) → statut **« En attente de validation »**,
      la session affiche **0** inscrit de plus, facture « en attente » côté caissier.
- [ ] Une seconde inscription du même apprenant à la même formation est refusée (« … en attente de
      validation de facture »).
- [ ] Changer le statut à la main : seul **Annulé** est proposé.
- [ ] Caissier : **accepte la preuve** (ou Valide la facture) → l'inscription passe **Inscrit**,
      l'apprenant apparaît dans la session choisie (compteur +1).
- [ ] Autre inscription en attente → **annuler** (ou rejeter) la facture → inscription **Annulé**,
      aucune place prise ; si l'apprenant avait été **créé** dans le formulaire et n'a rien d'autre,
      il disparaît de la liste des clients (son email peut être réutilisé).
- [ ] Caissier / admin : nouvelle inscription → **Inscrit** directement (inchangé).
- [ ] Page **Apprenants** d'un département → « Nouvelle inscription » : champs Moyen de paiement +
      Preuve de paiement ; « Créer » bloqué sans preuve pour un commercial / chef.
- [ ] Site client : inscription en ligne → « En attente » jusqu'à l'acceptation de la preuve.

Espace formateur (compte formateur, ex. « test test ») :
- [ ] Tableau de bord : les inscriptions par session = celles de la liste des Sessions de l'Académie
      (ex. 0 si personne dans sa session) ; « Apprenants formés » cohérent.
- [ ] Onglet **Sessions** : toutes ses sessions ; **Planning** : toutes les sessions à venir.
- [ ] Onglet **Apprenants** : clic sur un apprenant → sa fiche (sans bouton Modifier).
- [ ] Lien **Feuille de présence** d'une session → pointage enregistré.

Commercial / community manager lié à un profil formateur (ex. « TEST 2 ») :
- [ ] Menu : entrée **« Mes formations »** → onglets Tableau de bord, Formations, Apprenants,
      Sessions, Planning ; feuille de présence de **ses** sessions enregistrable.
- [ ] Un admin / super-admin **ne voit pas** « Mes formations » dans son menu.
- [ ] Un commercial **sans** profil formateur ne voit pas « Mes formations ».

Formations :
- [ ] Chef de département → « Nouvelle formation » : **pas** de message « droits nécessaires » ;
      seul son pays est coché ; cocher un autre pays → formation créée aussi dans ce pays.

Non-régression :
- [ ] Connexion de tous les rôles OK (colonne `users.deleted_at`).
- [ ] Vente rapide / facture d'un caissier : validée directement, encaissée.
- [ ] Fiche formateur côté admin (Académie → Formateurs) : statistiques affichées.
