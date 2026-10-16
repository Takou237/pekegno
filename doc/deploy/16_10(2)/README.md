# Déploiement immédiat — tout ce qu'il faut, dans l'ordre

Dossier unique avec les 3 fichiers à utiliser **maintenant**.
Détails, contrôles et recette complète : voir `../16_10/README.md`.
Rappel : pré-requis = lots 13/10 + 14/10 + 15/10 déjà appliqués en prod.

## Fichiers

| Fichier | Usage |
|---|---|
| `reset-prod-fresh-2026-10-16.sql` | **Optionnel** : remise à neuf (vide toute la base métier, garde `admin@pekegno.com` + `admin2@pekegno.com` / `12345678`). **Sauvegarde obligatoire avant.** À passer **en premier** si tu repars de zéro, sinon on l'ignore. |
| `migration-2026-10-16.sql` | Rattrapage `country_id`/`city_id` des agences (CA Côte d'Ivoire). **Toujours à passer** (même après la remise à neuf : rejouable sans effet). |
| `frontend-dist.zip` | Build admin du 16/10 (`VITE_API_URL=https://pekegnogroup.com/api`, `.htaccess` inclus). |

## Ordre

1. **Sauvegarde** : phpPgAdmin → base `sc1fopa5058_pekegno` → Exporter.
2. (Si remise à neuf) Onglet **Importer** → `reset-prod-fresh-2026-10-16.sql`.
3. Onglet **Importer** → `migration-2026-10-16.sql`.
4. cPanel → Git Version Control → `repositories/pekegno` → **Update from Remote**.
5. SSH `~/repositories/pekegno/backend` : `php artisan route:clear && php artisan config:clear && php artisan view:clear`, puis vider l'OPcache via `reset-opcache.php` (cf. `../README.md` §3.4) et **supprimer** le fichier.
6. Gestionnaire de fichiers → `/plateforme.pekegnogroup.com` → uploader `frontend-dist.zip` → **Extraire** en écrasant. Vérifier `.htaccess` présent.
7. Navigateur : **Ctrl+Maj+R**, puis recette (`../16_10/README.md` §4).
