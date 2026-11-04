# Déploiement — 04/11/2026 (frontend admin : API en `https://api.plateforme.pekegnogroup.com`)

Procédures générales et pièges o2switch : voir `doc/deploy/README.md`.

État prod de départ : lot `03_11(3)/` appliqué, sous-domaine `api.plateforme.pekegnogroup.com`
créé **avec SSL actif** (cf. `api-subdomain/README.md`, étapes 1 à 4).

## 1. Ce qui change

| Partie | Action |
|---|---|
| Code | **aucun changement** (même code que `03_11(3)` / `api-subdomain`, commit `be8f057`) |
| Frontend admin | `frontend-dist.zip` avec `VITE_API_URL=https://api.plateforme.pekegnogroup.com/api` (`.htaccess` inclus) |
| Base de données / `.env` / `vendor/` / routes | rien |
| Frontend client | non modifié |

Le suffixe `/api` est obligatoire : toutes les routes Laravel sont sous `/api/…`.

## 2. Contenu du dossier

| Fichier | Usage |
|---|---|
| `frontend-dist.zip` | Build admin du 04/11 — à extraire sur `/plateforme.pekegnogroup.com` |
| `README.md` | Ce fichier |

Validé : `tsc -b` + `vite build` OK ; l'URL `https://api.plateforme.pekegnogroup.com/api` est bien
présente dans le bundle.

## 3. Déploiement

0. Vérifier que `https://api.plateforme.pekegnogroup.com/api/` répond (réponse Laravel, cadenas
   vert, pas d'avertissement de certificat). Sinon : cPanel → SSL/TLS Status → Run AutoSSL.
1. Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` → uploader `04_11/frontend-dist.zip`
   → **Extraire** en écrasant. Vérifier `.htaccess` (afficher les fichiers cachés).
2. Navigateur : **Ctrl+Maj+R** sur `https://plateforme.pekegnogroup.com/login`.

## 4. Recette

- [ ] Connexion OK ; F12 → Réseau : les appels partent vers `https://api.plateforme.pekegnogroup.com/api/...`.
- [ ] Pas d'erreur CORS ni de certificat dans la console.
- [ ] Une création (client, facture…) réussit.
- [ ] Images des formations / services et cachet de facture s'affichent.

Diagnostic :
- « Erreur réseau » + erreur certificat → SSL du sous-domaine pas actif (étape 0).
- Erreur CORS → `FRONTEND_URL` du `.env` backend doit rester `https://plateforme.pekegnogroup.com`,
  puis `config:clear` + OPcache.

## Retour arrière

Réuploader `03_11(3)/frontend-dist.zip` (API sur `pekegnogroup.com`).
