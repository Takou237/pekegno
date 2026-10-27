# Déploiement + recette — 26/10/2026 (vente inter-agences, avance obligatoire)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`
(surtout §3.4 OPcache et §3.9 cache de routes).

État prod de départ : **lot du 22/10/2026 appliqué** (`22_10/`).
Contrôle (boîte SQL, `SELECT` uniquement) :
```sql
SELECT migration FROM migrations WHERE migration LIKE '2026_10_22%' ORDER BY migration;  -- 7 lignes
```
Si 0 ligne : appliquer **d'abord** `22_10/README.md` §3 étapes 1 → 4 (les 2 SQL),
puis enchaîner ici (le `frontend-dist.zip` du 26/10 remplace celui du 22/10).

## 1. Ce qui change (commits `0b360ae` → `775b36f`, déjà sur GitHub `master`)

| # | Changement | Partie |
|---|---|---|
| 1 | **Vente inter-agences** : un chef d'agence / de département, commercial, caissier… peut facturer un produit d'une autre agence (plus de 403 « agence hors de votre périmètre »). Le sélecteur d'agence de « Nouvelle facture » propose toutes les agences ; choisir un produit d'une autre agence bascule la facture sur l'agence du produit | Backend + Frontend |
| 2 | Recherche produits **ouverte pour la vente** (`/products/search?for_sale=1`) ; les écrans de gestion (ex. Réglages → Commissions) restent limités au périmètre | Backend + Frontend |
| 3 | `AgencyPolicy::view` : les rôles opérationnels peuvent consulter n'importe quelle agence (modification / suppression inchangées) | Backend |
| 4 | **Avance obligatoire pour tous les rôles** dès que le total > 0 (avant : super-admin seulement) — Nouvelle facture, Vente rapide (modale + page), Inscription formation | Backend + Frontend |
| 5 | **Vente rapide au guichet** : le montant reçu est encaissé par la création de la facture (plus d'appel `pay` séparé) ; montant reçu > total refusé | Frontend |
| 6 | **Inscription** : l'avance est encaissée après création de l'inscription → la commission du vendeur (formateur sans compte inclus) est bien générée | Backend |

| Partie | Action |
|---|---|
| Base de données | **aucune migration, aucun SQL** (`backend/database` inchangé depuis le 22/10) |
| Permissions | aucune |
| Routes | aucune nouvelle (cache de routes à vider quand même) |
| `vendor/` | **aucun changement** (`composer.json` / `composer.lock` inchangés) |
| `.env` | rien |
| Frontend admin | `26_10/frontend-dist.zip` (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus) |

Validé avant livraison : `tsc -b --noEmit` OK, build OK ; tests backend
**513 OK / 31 KO, les 31 uniquement « GD extension is not installed »**
(image de test sans GD — aucun échec fonctionnel).

## 2. Déploiement (dans cet ordre)

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter (structure + données).
2. **Backend** : cPanel → Git Version Control → `repositories/pekegno` → Manage →
   **Update from Remote**. Vérifier que le dernier commit affiché est `775b36f`.
3. **Caches** — SSH depuis `~/repositories/pekegno/backend` :
   `php artisan route:clear && php artisan config:clear && php artisan view:clear`
   puis **vider l'OPcache** : uploader `doc/deploy/reset-opcache.php` dans
   `backend/public/`, ouvrir `https://pekegnogroup.com/reset-opcache.php`
   → « OPcache vidé avec succès » → **supprimer le fichier**.
4. **Frontend** : Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` →
   uploader `26_10/frontend-dist.zip` → **Extraire** en écrasant (garder les
   anciens `assets/`). Vérifier `.htaccess` présent (afficher les fichiers cachés).
5. Navigateur : **Ctrl+Maj+R**, puis recette.

Retour arrière : repointer le dépôt sur `0680f13`, vider caches + OPcache,
réuploader `22_10/frontend-dist.zip`. Aucune donnée à restaurer (pas de SQL).

## 3. Recette

- [ ] **Chef d'agence de A** → Nouvelle facture → choisir un produit de l'agence B → pas de 403, la facture est créée sur l'agence B.
- [ ] Le sélecteur **Agence** de Nouvelle facture liste toutes les agences (nom, code, pays).
- [ ] **Avance vide** sur une facture > 0 (n'importe quel rôle) → « L'avance est obligatoire. » ; avance > total → refusée.
- [ ] **Caissier → Vente rapide** : montant reçu 5 000 sur 10 000 → facture partielle, reçu imprimable du versement ; montant reçu > total → refusé.
- [ ] **Commercial → Vente rapide** : avance obligatoire + preuve → facture en attente (pas d'encaissement).
- [ ] **Inscription formation** (caissier / admin) avec avance → versement visible, commission du vendeur générée ; sans avance → refusée.
- [ ] **Réglages → Commissions** → règle ciblant un produit précis : la recherche ne propose que les produits du périmètre.
- [ ] Listes de gestion (Produits, Agences…) d'un chef d'agence : toujours limitées à son agence.
