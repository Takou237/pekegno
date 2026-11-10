# Déploiement + recette — 08/11/2026 (branche `corrections` : corrections WORLDEV, lots 1, 2 et bugs P1)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.2 import SQL, §3.4 OPcache, §3.9 cache de routes).

État prod de départ : **lot `04_11(2)/` appliqué** + correctifs `master` `20a2abe` et `d923245`
(numéro client, numéro de dépense, suppressions de compte). Dernière migration en prod :
`2026_11_04_000001`.

⚠️ **Ce lot vient de la branche `corrections`.** La prod se met à jour par un `git pull` de
`master` : il faut d'abord fusionner `corrections` dans `master` (étape 0). Tant que ce n'est
pas fait, **ne rien importer** : le SQL de ce dossier n'est utile qu'avec ce code.

## 1. Ce qui change

| # | Changement | Réf. cahier | Partie |
|---|---|---|---|
| 1 | **Un seul calcul financier** (CA = factures validées, encaissé, acomptes, impayés, dépenses, en attente, net caisse) pour toutes les pages, et cartes de la section 1 en tête des tableaux de bord groupe, pays, agence et département | §1, B1, B2, B17 | Backend + Frontend |
| 2 | **Annuler une facture annule aussi ses paiements**, ses recettes comptables, ses commissions et l'entrée en caisse | B9 | Backend |
| 3 | **Comptabilité paginée**, totaux calculés sur toute la période | B10 | Backend + Frontend |
| 4 | **Date de réception ≠ date de validation** : un paiement reçu le 02/11 et validé le 03/11 compte le 02/11 (Bilan, caisses, Comptabilité) | B11, B12 | Backend |
| 5 | **Caisses codifiées C / O / M / B (+ W / V en Côte d'Ivoire)** : chaque paiement va dans la caisse de son mode ; la caissière ne voit que la caisse espèces (C) | §2 | Backend + Frontend |
| 6 | **Transferts entre caisses** (versement en banque, décaissement administratif) : jamais comptés en dépense | B13, §2 | Backend + Frontend |
| 7 | **Clôture journalière de caisse** (solde compté, écart, justification) validée par le chef d'agence, en heure locale | §2 | Backend + Frontend |
| 8 | **Dépense saisie en Comptabilité** : caisse obligatoire, l'argent sort de la caisse choisie | §2 | Backend + Frontend |
| 9 | **Bilan du jour** : ventes d'un côté, caisses de l'autre ; total période = premier solde initial et dernier solde final ; solde initial consolidé = somme des soldes finaux de la veille, plus jamais réécrit | §2, B5, B6 | Backend + Frontend |
| 10 | **Ventes par catégorie** : catégorie reprise de la ligne de facture, total égal au CA ; même branche (Academy / Agency / Store / Studio) sur toutes les pages. **Rubriques** : Academy (inscriptions), Agency (packages, prestations), Séminaire (tout service coché « Service séminaire (Pass) », quelle que soit sa catégorie), puis une par catégorie du catalogue (Livre, Canva… : créer une catégorie crée sa rubrique, branche Store). Une colonne au Bilan du jour (même à zéro) et une ligne dans « Recettes par rubrique » en Comptabilité | B4, B24, §2 rubriques | Backend + Frontend |
| 11 | **Aucune facture ne disparaît** : filtre « Annulée » de la liste réparé ; une facture retirée par le client est annulée (plus jamais supprimée) ; annulation via la suppression d'une inscription tracée au journal | B8 | Backend |
| 12 | **Devises** : en vue multi-pays, montants XOF convertis dans la monnaie du groupe avant d'être additionnés (Bilan, Suivi des ventes) ; bouton de devise sur PEKEGNO Group | B14 | Backend + Frontend |
| 13 | **Taux de recouvrement** : sa base est affichée sous la carte (encaissé sur les factures de la période ÷ CA) | B15 | Frontend |
| 14 | **CA d'un commercial dans l'agence de la facture** (classements, filtres) | B16 | Backend |
| 15 | **Revenus potentiels Académie** = somme des prix des inscriptions | B7 | Backend |
| 16 | **Espace formateur « Mes réalisations »** (réalisations du pôle studio assignées) | — | Backend + Frontend |
| 17 | **Vente d'un séminaire** : le même service peut revenir sur une autre ligne pour un autre niveau (2 Classique + 1 VIP) ; jamais deux lignes du même niveau | — | Frontend |
| 18 | **Chaque versement prend la catégorie de sa rubrique** en Comptabilité (Academy, Agency, Séminaire, Livre, Canva…) au lieu d'une catégorie vide ; facture mixte = rubrique principale ; contre-passation dans la même rubrique | B4 | Backend |
| 19 | **Journée de caisse détaillée** (Bilan, Clôtures) : solde initial, entrées, sorties, transferts reçus / envoyés, solde théorique = initial + entrées − sorties ± transferts ; une annulation de paiement est déduite des entrées (plus une sortie) | §2 | Backend + Frontend |
| 20 | **Transferts guidés** : on choisit d'abord le type (versement en banque C/O/M → B, retrait O/M → C, décaissement administratif depuis C, interne) ; seules les caisses possibles sont proposées, le serveur refuse les autres sens ; badge « Transfert » et filtre dans les mouvements | §2, B13 | Backend + Frontend |
| 21 | **Dates de validation visibles** : facture « Validée le … par … » ; chaque versement affiche « Reçu le » et « Validé le » (aussi sur le reçu) | §1, B11 | Backend + Frontend |

| Partie | Action |
|---|---|
| Base de données | `migration-2026-11-08.sql` : 8 migrations (paiements, caisses, transferts, clôtures, écritures, catégorie des lignes, branche des articles) + droit `tresories.consulter` / `tresories.modifier` pour le caissier |
| Données | **6 commandes de rattrapage** (étape 5), chacune en simulation d'abord |
| Routes | **nouvelles** (clôtures, transferts, réalisations formateur…) → **vider le cache de routes** |
| `vendor/` | **aucun changement** |
| `.env` | rien d'obligatoire. Option : `API_RESPONSE_CACHE=false` coupe le cache des statistiques |
| Frontend admin | `frontend-dist.zip` (`VITE_API_URL=https://api.plateforme.pekegnogroup.com/api`, `.htaccess` inclus) |
| Frontend client | non modifié |

⚠️ **Ordre critique** : le code lit les nouvelles colonnes sur les factures, paiements, bilans,
tableaux de bord et la comptabilité. Entre le `git pull` (étape 1) et l'import SQL (étape 2),
ces pages renvoient « Server Error ». Enchaîner les étapes 1 et 2 sans attendre, de préférence
hors des heures de vente.

## 2. Contenu du dossier

| Fichier | Usage | Quand |
|---|---|---|
| `migration-2026-11-08.sql` | 8 migrations + droit caissier + lignes `migrations` (rejouable, une transaction) | phpPgAdmin → **Importer**, **juste après** le `git pull` |
| `frontend-dist.zip` | Build admin du 08/11 (remplace `04_11(2)/`) | Extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier | — |

Validé avant livraison :
- `tsc -b` + `vite build` OK ; `https://api.plateforme.pekegnogroup.com/api` est la seule URL
  d'API du bundle ;
- `migration-2026-11-08.sql` importé **deux fois** sur PostgreSQL **9.6.24** à partir d'un
  schéma identique à la prod (2026_11_04_000001), avec des caisses existantes : aucune erreur,
  aucun doublon, codes C / C2 / O / B / W attribués correctement ;
- schéma obtenu **identique** à celui des migrations Laravel (comparaison `pg_dump`) ;
- tests backend (image Docker PHP 8.3, SQLite mémoire) : **630 OK**. Aucun nouvel échec — les
  37 échecs restants sont les échecs connus (cf. `CLAUDE.md`).

## 3. Déploiement (dans cet ordre)

0. **(Local) Fusionner et pousser** : `git switch master && git merge corrections && git push`.
   Noter le hash du commit obtenu.
1. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est celui de l'étape 0.
2. **Base (immédiatement)** : phpPgAdmin → base `sc1fopa5058_pekegno` → onglet **Importer** →
   `migration-2026-11-08.sql`. Contrôle (boîte SQL, SELECT seul) :
   `SELECT migration FROM migrations WHERE migration > '2026_11_04_000001' ORDER BY migration;`
   → 8 lignes.
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear && php artisan cache:clear`
   puis **vider l'OPcache** : uploader `doc/deploy/reset-opcache.php` dans `backend/public/`,
   ouvrir `https://api.plateforme.pekegnogroup.com/reset-opcache.php` → « OPcache vidé avec
   succès » → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` → uploader
   `08_11/frontend-dist.zip` → **Extraire** en écrasant. Vérifier `.htaccess` présent.
5. **Rattrapage des données** — SSH, depuis `~/repositories/pekegno/backend`. Chaque commande
   **simule** sans `--apply` : lire la liste, puis relancer avec `--apply`. Toutes sont rejouables.
   1. `php artisan db:seed --class=TreasuryAccountSeeder --force` — crée les caisses manquantes
      (C / O / M / B, + W / V en Côte d'Ivoire) de chaque agence. Ne modifie pas les caisses existantes.
   2. `php artisan invoices:reverse-cancelled-payments` puis `--apply` — B9 : annule les paiements,
      recettes et commissions restés sur des factures annulées.
   3. `php artisan treasury:backfill-payments` puis `--apply` — rattache chaque paiement à la caisse
      de son mode, crée les entrées en caisse, corrige la date de réception depuis la preuve (B11).
      Les paiements « mobile » ambigus sont listés : à trancher à la main.
   4. `php artisan treasury:reclassify-transfers` puis `--apply` — B13 : versements en banque saisis
      en dépense → transferts C → B. **Relire la liste** (filtre `--id=…` possible).
   5. `php artisan accounting:reassign-departments` puis `--apply` — recettes des ventes directes
      d'articles du catalogue (livres, Canva… quelle que soit la catégorie) rattachées au département Store.
   6. `php artisan accounting:categorize-income` puis `--apply` — B4 : chaque recette de facture sans
      catégorie (ou « Encaissement facture ») reçoit la catégorie de sa rubrique. Ne touche pas aux
      recettes saisies à la main.
6. **Première clôture** de chaque caisse avec l'équipe : saisir le solde réellement compté ;
   les écarts historiques sont justifiés une seule fois.
7. Les utilisateurs se **déconnectent / reconnectent**, puis **Ctrl+Maj+R**.

## 4. Recette (à faire avec l'équipe Pekegno)

| Contrôle | Où | Attendu |
|---|---|---|
| CA identique partout | Tableau de bord groupe, Pays, Comparaison CA, Rapport clients | Même chiffre ; CA = Encaissé (hors recouvrements) + Impayés |
| Paiement reçu la veille, validé le lendemain | Bilan du jour | Compté le jour de la preuve |
| Caisse C de Douala | Bilan du jour (bloc Caisses) | Espèces seulement ; OM et MTN dans O et M |
| Versement en banque | Trésorerie → Transfert | Pas dans les dépenses ; C diminue, B augmente ; au Bilan, colonne « Transferts » et non « Sorties » ; un retrait B → C est refusé |
| Clôture | Trésorerie → Clôtures | Chaque caisse affiche initial / entrées / sorties / transferts / théorique du jour ; la caissière clôture C ; le chef d'agence valide |
| Total période / solde consolidé | Bilan du jour, vue période et consolidée | Premier solde initial / dernier solde final ; solde initial du jour = somme des soldes finaux de la veille |
| Ventes par catégorie | Tableau de bord | Total = carte CA ; plus de « Sans catégorie » géant |
| Catégorie des versements | Comptabilité → liste | Plus de « — » : chaque versement affiche sa rubrique (Livre, Séminaire, Academy…) |
| Rubriques | Créer une catégorie « Goodies » ; vendre un service séminaire (Pass) | Nouvelle colonne au Bilan (période) et ligne à 0 en Comptabilité → Recettes par rubrique ; le Pass va dans « Séminaire », pas dans sa catégorie |
| Livre « Comment gagner de l'argent… » | Suivi des ventes + Tableau de bord | Store sur les deux pages |
| Facture annulée | Factures → filtre « Annulée » | Visible |
| Caissière | Trésorerie | Ne voit pas les soldes O / M / B |

## 5. Diagnostic

- « Server Error » sur factures, bilans, tableaux de bord juste après le pull → SQL non importé
  (étape 2). Dans `storage/logs/laravel.log` : `column ... received_at / is_transfer does not exist`.
- Statistiques figées après l'import → `php artisan cache:clear` (cache des réponses API).
- Une page du front affiche encore l'ancien écran → OPcache non vidé (backend) ou Ctrl+Maj+R (front).
- Retour arrière : `git` cPanel sur `d923245` ; les colonnes ajoutées par le SQL ne gênent pas
  l'ancien code (aucune suppression de colonne dans ce lot).
