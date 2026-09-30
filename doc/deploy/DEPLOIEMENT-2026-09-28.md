# Déploiement + recette — tickets Academy du 28/09/2026 (T1 → T19)

Procédures générales et pièges : voir `README.md` (même dossier).

> ✅ **Déploiement terminé le 30/09/2026.** Les migrations `migration-2026-09-28.sql`, `-29.sql`, `-30.sql`,
> `-30-2fa.sql`, `-30-payer-phone.sql` sont **appliquées en prod** et `repair-enrollment-payments.php` a été
> **exécuté** : ne rien réimporter ni relancer lors des prochains déploiements. Ce document reste comme
> historique et checklist de recette. État courant de la prod : `README.md` §1 « État de la production ».

## Ce qui change

Aucun des tickets T1–T19 n'est encore en production : tout part en un seul déploiement.
Vérifié : `schema.sql` + `seed-roles-permissions.sql` + `migration-2026-09-28.sql` donnent exactement
les mêmes colonnes, migrations et associations rôle/permission (694) qu'une base construite par
`php artisan migrate` + seeders avec le code actuel.

| Partie | Changement | Action |
|---|---|---|
| Base de données | colonnes `formation_enrollments.discount_type/discount_value` (T5), `countries.exchange_rate` (T11), réglage `group_currency`, permission `commissions.encaisser` pour la caissière (T4) | importer `migration-2026-09-28.sql` |
| Backend PHP | contrôleurs, modèles, routes | `git pull` via cPanel + vider l'OPcache |
| `vendor/` | **aucun changement** (`composer.json`/`.lock` inchangés) | rien |
| Frontend admin | nouveau build | uploader `frontend-dist.zip` |
| `.env` backend | SMTP pour les emails (T8, T9, T14) | ajouter les variables `MAIL_*` |

## Déploiement (dans cet ordre)

1. **Sauvegarde de la base** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Base de données** (avant le code : le nouveau backend lit `countries.exchange_rate`) :
   phpPgAdmin → base → onglet **Importer** → `doc/deploy/migration-2026-09-28.sql`.
   Le script peut être rejoué sans erreur (validé deux fois de suite sur PostgreSQL 9.6).
   Contrôle rapide :
   ```sql
   SELECT key, value FROM settings WHERE key = 'group_currency';   -- "XAF"
   SELECT name, currency_code, exchange_rate FROM countries;        -- taux 1
   ```
3. **Code backend** : pousser les commits sur GitHub, puis cPanel → Git Version Control →
   `repositories/pekegno` → Manage → **Update from Remote**.
4. **Emails** (`backend/.env` via le Gestionnaire de fichiers) : créer d'abord la boîte mail dans cPanel,
   puis renseigner le bloc `MAIL_*` décrit dans `README.md` §3.8. Vérifier aussi
   `FRONTEND_URL=http(s)://plateforme.pekegnogroup.com` : le lien de réinitialisation envoyé par email
   pointe vers cette adresse. Ne jamais coller le mot de passe dans un chat.
5. **OPcache** : uploader `reset-opcache.php` dans `repositories/pekegno/backend/public/`, ouvrir
   `https://pekegnogroup.com/reset-opcache.php`, vérifier le message de succès, **supprimer le fichier**.
6. **Frontend** : vider `/plateforme.pekegnogroup.com`, y uploader puis extraire `doc/deploy/frontend-dist.zip`
   (build fait avec `VITE_API_URL=https://pekegnogroup.com/api`). Le `.htaccess` (fallback SPA) est
   désormais inclus dans le zip : afficher les fichiers cachés pour vérifier qu'il est bien présent.
7. Navigateur : **Ctrl+Maj+R** (ancien JS en cache), puis faire la recette ci-dessous.

Retour arrière : restaurer la sauvegarde de l'étape 1, repointer le dépôt sur le commit précédent,
réuploader l'ancien build frontend. Les colonnes ajoutées sont sans effet sur l'ancien code.

## Recette (à faire en prod après déploiement, ou en local)

Comptes utiles : un super-admin, une **caissière**, un **commercial**.

### P0
- [ ] **T1 Bilan** : Pays → Bilan du jour, onglet Période. Colonnes attendues : Date | **Formations** | une colonne
  par catégorie du catalogue (même à 0) | Total ventes | Espèces… Faire une inscription payée aujourd'hui :
  le montant apparaît dans la colonne Formations. Faire une facture « Conseil » : il apparaît dans Conseil.
  Tester aussi l'export CSV.
- [ ] **T2 CA** : même période partout (ex. « Ce mois »). Le CA de l'agence, celui du pays et celui de PEKEGNO GROUP
  doivent concorder pour un pays à une seule agence. Une facture créée par un commercial (en attente) ne compte
  nulle part tant qu'elle n'est pas validée.
- [ ] **T3 Pays d'une agence** : modifier une agence → le champ Pays est une **liste déroulante** des pays en base.
  Passer de Cameroun à Côte d'Ivoire → l'agence apparaît dans la liste des agences CIV, ses factures sont comptées
  dans le CA CIV, ses utilisateurs sont rattachés au pays CIV. Remettre le pays d'origine après le test.
- [ ] **T4 Commission (caissière)** : connecté en caissière, payer une commission depuis Academy → Paiements
  (profil vendeur), puis depuis Comptabilité / Commissions. Plus aucune erreur « non autorisé ». Elle ne doit
  toujours pas pouvoir créer ni valider une commission.

### P1
- [ ] **T5 Remise** : nouvelle inscription avec 10 % puis avec 5 000 fixe, en commercial et en caissière :
  le net à payer est affiché avant validation et la facture porte la remise. Une remise supérieure au prix est refusée.
- [ ] **T6** : la liste des formations d'une inscription affiche « Nom — En ligne/Présentiel · Prix ». Une formation
  en ligne sans session s'inscrit sans erreur.
- [ ] **T7** : depuis une liste de factures filtrée (page 2), ouvrir une facture puis l'annuler → retour sur la même
  liste, même page, mêmes filtres. Dans « Encaisser », après une vente, le formulaire est vide.
- [ ] **T8** : créer un utilisateur avec une vraie adresse → il reçoit l'email avec son identifiant et son mot de
  passe (nécessite le SMTP de l'étape 4).
- [ ] **T9** : Utilisateurs → icône clé sur une ligne → l'utilisateur reçoit un nouveau mot de passe et son ancienne
  session est fermée.
- [ ] **T10** : en super-admin, le menu contient « Validation ».

### P2
- [ ] **T11 Monnaie** : ouvrir le pays Côte d'Ivoire → les montants sont en **XOF**. Cameroun → FCFA. Une facture
  d'une agence ivoirienne affiche XOF (détail, impression, montant en lettres). Pays → icône crayon → le champ
  « Équivalence 1 XOF = ? XAF » existe. Test de conversion : mettre 2, vérifier que le CA CIV compte double dans
  le tableau de bord PEKEGNO GROUP, puis **remettre 1**. Réglages → « Monnaie PEKEGNO GROUP ».
- [ ] **T12** : Academy → Formations → Nouvelle formation → sous « Déployer aussi dans d'autres pays », tous les
  pays sont cochés.
- [ ] **T13 Header** : se déconnecter puis se reconnecter **sans recharger la page** → les listes Pays / Agence /
  Département contiennent des options. Choisir un pays, puis une agence : navigation OK. Choisir l'option vide
  « Agence » → retour au pays ; option vide « Pays » → retour à PEKEGNO GROUP. Réduire la fenêtre (< 1024 px) :
  le bouton « ← Retour » reste visible.
- [ ] **T14** : Connexion → « Mot de passe oublié » avec une vraie adresse → email reçu, le lien ouvre
  `/reset-password` et le nouveau mot de passe fonctionne. Avec une adresse inconnue : même message, aucun email.
- [ ] **T15** : Utilisateurs → Nouvel utilisateur → taper « Jean-Marc » / « Élé » → le nom d'utilisateur
  devient `jeanmarc.ele` (ou `jeanmarc.ele2` s'il est déjà pris). Le modifier à la main, puis changer le prénom :
  la saisie manuelle n'est pas écrasée.
- [ ] **T16 Périodes** : raccourcis « Aujourd'hui, Hier, Cette semaine, Semaine dernière, Ce mois… » sur les
  tableaux de bord, le bilan, les factures, la comptabilité, les créances Academy, l'audit et les rapports.
  « Ce mois » doit commencer le **01** du mois (avant : le 31 du mois précédent).

### P3
- [ ] **T17** : clic sur le logo (header ou menu latéral) → tableau de bord général.
- [ ] **T18** : nouveau logo coloré dans le header, le menu, la page de connexion et l'impression des factures ;
  icône « P » dans l'onglet du navigateur.
- [ ] **T19** : passer en revue les listes déroulantes des formulaires (agence, utilisateur, inscription, facture).

## Mise à jour du 29/09 (corrections après recette)

Base : importer **`migration-2026-09-29.sql`** (après celui du 28/09 ; rejouable) — colonne
`countries.invoice_settings` (modèle de facture), Cameroun pré-rempli depuis le modèle Word,
permission de paiement des commissions de la caissière, types de formation `presentiel` → `in_person`.
Code : push + « Update from Remote » + **OPcache** ; frontend : nouveau `frontend-dist.zip`.

Puis, une seule fois :
1. **Paiements d'inscription manquants** : uploader `repair-enrollment-payments.php` dans `backend/public/`,
   ouvrir `https://pekegnogroup.com/repair-enrollment-payments.php` (simulation : liste des factures),
   puis `...?apply=1` pour enregistrer, et **supprimer le fichier**.
2. **Emails** : uploader `mail-test.php` dans `backend/public/`, ouvrir `https://pekegnogroup.com/mail-test.php`,
   lire le diagnostic, **supprimer le fichier**. Si la connexion à `smtp.gmail.com` est en ÉCHEC,
   o2switch n'intercepte pas le port 465, mais le certificat TLS du serveur mail ne
   couvre pas `mail.pekegnogroup.com` : utiliser le hostname validé
   `mail.lynx.o2switch.net` (même serveur, cf. README §3.8 et sa procédure cPanel).
   Si « Config en cache : OUI », supprimer `backend/bootstrap/cache/config.php` puis vider l'OPcache.
3. **Cachet** : Pays → crayon sur Cameroun → « Cachet / signature » → téléverser l'image, enregistrer
   (nécessite le lien `storage`, cf. `setup-storage-link.php`).

### Recette complémentaire (29/09)
- [ ] Caissière : menu **Commissions** → Payer une commission (plus de « Action non autorisée »).
- [ ] Caissière d'une agence : ne voit que les bénéficiaires de son agence.
- [ ] Pays Côte d'Ivoire → Factures : seulement les factures ivoiriennes, montants en **XOF** ; clic sur une
      facture → reste sous `/countries/.../invoices/...` ; « Nouvelle facture » avec une agence ivoirienne → XOF.
- [ ] Pays → Services → Academy → Nouvelle inscription : la liste des formations s'affiche (avec l'agence).
- [ ] Agence → Équipes (et Département → Équipes) : icône clé de réinitialisation du mot de passe.
- [ ] Profil → activer la 2FA → le statut passe à **activée** (et reste activé après reconnexion).
- [ ] Inscription payée par la caissière → Bilan : le montant apparaît dans **Total encaissé** et en caisse.
- [ ] Vente faite après minuit (heure de Douala) → comptée le bon jour dans le bilan.
- [ ] Bilan vue consolidée : « Solde initial » = somme des soldes initiaux des agences.
- [ ] Facture → Imprimer → PDF sur une page A4, au format du modèle (en-tête entité, DESTINATAIRE, Désignation /
      Description / Période / Prix, TOTAL, somme en lettres, moyens de paiement, cachet, pied NUI).
- [ ] Modifier le pays d'une agence depuis ses Paramètres → la page bascule sous le nouveau pays ; les clients
      inscrits dans l'agence suivent.
- [ ] Super-admin : entrée **Factures** dans le menu.

## Mise à jour du 30/09 (reçu de versement)

Une facture non soldée ne s'imprime toujours pas, mais **chaque versement a désormais son reçu imprimable**
(numéro `REC-AAAAMMJJ-NNN`, montant en lettres, déjà versé, reste à payer, cachet du pays).

Base : importer **`migration-2026-09-30.sql`** (après celui du 29/09 ; rejouable, validé sur PostgreSQL 9.6) —
ajoute `invoice_payments.receipt_number` et numérote les versements déjà enregistrés.
Code : push + « Update from Remote » + **OPcache** ; frontend : nouveau `frontend-dist.zip`.

### Recette
- [ ] Facture avec un acompte (statut partiel) : bouton **Imprimer** toujours grisé ; dans l'historique des paiements,
      bouton **Reçu** sur chaque ligne → aperçu → Imprimer le reçu (une page A4).
- [ ] Le reçu affiche : numéro REC-…, client, montant en chiffres et en lettres, mode, caissier, total facture,
      déjà versé avant, total versé à ce jour, **reste à payer**, mention « ne vaut pas facture acquittée ».
- [ ] Encaisser un 2ᵉ versement depuis la facture → le reçu s'ouvre automatiquement ; son « déjà versé » = 1ᵉʳ versement.
- [ ] Encaisser (vente rapide) avec montant reçu → lien **Imprimer le reçu** dans le bandeau de confirmation.
- [ ] Colonne « Encaissé par » de l'historique : le nom du caissier s'affiche (avant : « — »).
- [ ] Dernier versement qui solde la facture : le reçu indique « Ce versement solde la facture » et la facture devient imprimable.
- [ ] Département → Formations → fiche d'une formation → Nouvelle inscription : champs **Remise accordée** / **Valeur**,
      le net à payer s'affiche avant validation et la facture porte la remise.
- [ ] Agence → Équipes → Créer un utilisateur : « Département (optionnel) » est une **liste déroulante** des départements de l'agence.
- [ ] Pays → Paramètres → Créer un utilisateur : Agence = liste déroulante des agences **du pays**, puis Département = liste
      déroulante des départements de l'agence choisie.

## Mise à jour du 30/09 (soir) — 2FA email + téléphone payeur

Base : `migration-2026-09-30-2fa.sql` (`users.two_factor_channel`) puis `migration-2026-09-30-payer-phone.sql`
(`invoices.payer_phone`) — **appliqués en prod le 30/09**. Frontend reconstruit (`frontend-dist.zip`).

### Remise à zéro des transactions (optionnel, irréversible)
Si l'on repart de zéro (CA, dépenses, trésorerie, commissions…) : **sauvegarde** de la base, puis importer
`reset-transactions.sql`, **après** `migration-2026-09-30.sql`. La configuration (pays, agences, utilisateurs, catalogue) est conservée.
