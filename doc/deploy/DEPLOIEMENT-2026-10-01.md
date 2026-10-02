# Déploiement + recette — 01/10/2026

Procédures générales et pièges : voir `README.md` (même dossier).

## Ce qui change

| # | Changement | Partie |
|---|---|---|
| 1 | « Nouvelle vente » : la liste **Produit** ne propose plus que les **services** (plus les formations, qui se vendent par une inscription) | Frontend |
| 1b | « Nouvelle vente » : le bloc « Apprenant existant / Créer un nouvel apprenant » est remplacé par le champ **Client** de « Nouvelle facture » (recherche d'un client, ou saisie libre d'un nouveau nom) ; le champ **Vendeur** est masqué pour un commercial (la vente lui est rattachée automatiquement) | Frontend |
| 1c | Pages **Services** (pays, agence) et **Produits** (département) : « Nouvelle formation » ouvre désormais le **formulaire complet** de la page Formations (catégories, durée, objectif, prérequis, vidéo, image, déploiement multi-pays) | Frontend |
| 1d | « Créer un service » : bloc **Déployer aussi dans d'autres pays** comme pour les formations (le service est créé dans toutes les agences des pays cochés ; tous les pays actifs cochés par défaut, comme les formations). Le champ **Agence** n'apparaît plus à la création (seulement en modification) : sur une page agence, cette agence reçoit toujours le service. Correction : la **Prime fixe** saisie n'était jamais enregistrée | Backend + Frontend |
| 5 | **Bilan du jour** : demander le 01/10 affichait le bilan du **30/09** (décalage UTC / heure de Douala dans `BilanService::period`) — les ventes du jour n'apparaissaient jamais | Backend |
| 5b | **Bilan du jour** : les colonnes de ventes (catégories, Formations, Total ventes) affichent désormais le **montant encaissé** dans la journée, réparti sur les lignes de la facture, et non plus le montant facturé. « Total ventes » = « Total encaissé » ; un solde versé plus tard compte le jour du versement. Les impayés restent dans les Créances | Backend |
| 6 | Vente **sans agence** (inscription à une formation globale, ou vente saisie par un admin sans agence) : la facture est maintenant rattachée à l'agence du **vendeur** (sinon de l'utilisateur connecté). Avant : facture absente du bilan, versement hors caisse, écriture comptable sans agence. Réparation des factures existantes : `repair-missing-agency.php` | Backend + script one-shot |
| 2 | Vente (ou inscription) saisie par un **commercial** → en plus de la file « Factures en attente », un **email** part aux caissiers : ceux de l'agence de la facture, à défaut ceux du même pays, à défaut tous les caissiers actifs. Un SMTP en panne ne bloque plus ni la vente, ni la validation / le rejet | Backend |
| 3 | **Prospect → client** (compte commercial) : le client créé n'avait pas d'agence, il disparaissait du périmètre du commercial (introuvable dans ses clients et dans « Rechercher un apprenant »). Il hérite désormais de l'agence et du commercial du prospect, et le vrai message d'erreur s'affiche en cas d'échec | Backend + Frontend + SQL de réparation |
| 4 | **« Failed to fetch dynamically imported module »** : chargement d'une page retenté automatiquement (attente du retour du réseau), rechargement automatique si le fichier vient d'un ancien build, sinon écran « Connexion perdue / Impossible de charger la page » avec bouton Réessayer — qui se recharge seul au retour de la connexion. `.htaccess` : `index.html` jamais mis en cache, fichiers `assets/` en cache long, 404 propre pour un fichier de build absent | Frontend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration**. Importer une fois `repair-converted-clients-2026-10-01.sql` (rattache les clients déjà convertis) |
| Backend PHP | `git pull` via cPanel + vider les caches + l'OPcache |
| `vendor/` | **aucun changement** |
| Frontend admin | uploader `frontend-dist.zip` (build du 01/10, `VITE_API_URL=https://pekegnogroup.com/api`) |
| `.env` backend | rien de nouveau ; l'email aux caissiers n'est réellement envoyé que si le SMTP est configuré (README §3.8) |

## Déploiement (dans cet ordre)

1. **GitHub** : pousser `master` (fait par l'utilisateur).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage → **Update from Remote**.
3. **Caches** (README §3.9) — en SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   (nouveau gabarit d'email `emails/pending-invoice`). Puis **vider l'OPcache** via
   `reset-opcache.php` (README §3.4) et **supprimer** le fichier.
4. **Base** : phpPgAdmin → base `sc1fopa5058_pekegno` → onglet **Importer** →
   `repair-converted-clients-2026-10-01.sql`. Idempotent : le message attendu est
   `UPDATE n` (n = clients convertis par un commercial encore sans agence ; 0 si aucun).
5. **Factures sans agence** (après l'étape 3) : uploader `repair-missing-agency.php` dans
   `backend/public/`, ouvrir `https://pekegnogroup.com/repair-missing-agency.php` → **simulation**
   (liste « facture → agence ; versements rangés dans la caisse … »). Si c'est correct, ouvrir
   `…/repair-missing-agency.php?apply=1`. Une ligne « agence introuvable » est à corriger à la main.
   **Supprimer le fichier** ensuite. Relancer est sans danger (déjà réparé = ignoré).
6. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `frontend-dist.zip` → **Extraire** en écrasant. Il n'est plus
   nécessaire de vider l'ancien contenu : garder les anciens fichiers de
   `assets/` permet même aux onglets déjà ouverts de continuer à fonctionner.
   Vérifier que `.htaccess` a bien été remplacé (il contient désormais un bloc
   `mod_headers` « Cache-Control »).

## Recette

- [ ] **Commercial** → Catalogue → **Nouvelle vente** : la liste « Produit » ne montre que des services (aucune formation).
- [ ] **Commercial** → **Nouvelle vente** : plus de bloc « Apprenant existant / Créer un nouvel apprenant » ni de champ « Vendeur » ; le champ Client trouve un client existant, ou accepte un nom saisi librement.
- [ ] Services d'un pays → onglet Formations → **Nouvelle formation** : même formulaire que la page Formations (catégories, durée, objectif, prérequis, vidéo, image, pays).
- [ ] **Créer un service** avec 2 pays cochés → le service apparaît dans les agences des deux pays ; avec une **Prime fixe** de 1 000 → la valeur est bien enregistrée (rouvrir le service).
- [ ] **Bilan du jour** : une inscription à 50 000 avec 10 000 d'avance → Formations = 10 000 et Total ventes = Total encaissé ; verser 15 000 le lendemain → 15 000 dans le bilan du lendemain.
- [ ] **Bilan du jour**, période = aujourd'hui → la ligne porte la **date du jour** (plus la veille) et inclut les ventes de la soirée.
- [ ] Admin sur la page Services d'un pays → **Nouvelle inscription** à une formation globale avec un caissier comme vendeur → la facture a l'agence du caissier, le versement apparaît dans sa caisse et dans le bilan du jour de cette agence.
- [ ] **Commercial** crée une vente avec preuve → le **caissier de son agence** reçoit l'email « Facture … en attente de validation » (vérifier les spams) ; le bouton mène à `/invoices/pending`. La facture apparaît aussi dans la cloche / file d'attente du caissier.
- [ ] **Commercial** → Prospects → convertir un prospect → le client apparaît dans sa liste de clients et dans « Rechercher un apprenant » d'une nouvelle vente.
- [ ] Convertir un prospect dont l'email existe déjà → message « Un client avec cet email existe déjà. » (et non plus un message générique).
- [ ] Ouvrir la plateforme, **couper le Wi-Fi**, cliquer vers une page jamais visitée → écran « Connexion perdue » (plus d'« Unexpected Application Error ») ; **remettre le Wi-Fi** → la page se charge toute seule.
- [ ] Caissier : valider puis rejeter une facture → OK même si le SMTP est indisponible.
