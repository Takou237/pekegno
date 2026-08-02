# PEKEGNO

Plateforme multi-agence SaaS (CRM, Formations, Facturation, Comptabilité).

## Stack

- **Backend :** Laravel 13 + PHP 8.3 (Docker)
- **Base de données :** PostgreSQL 12 (local)
- **Frontend :** React + Vite + Tailwind (à venir)

---

## Installation

```bash
# 1. Cloner
git clone https://github.com/Takou237/pekegno.git pekegno
cd pekegno

# 2. Build l'image Docker PHP
sudo docker build -t pekegno-php docker/php/

# 3. Copier et configurer .env
cp backend/.env.example backend/.env
# Éditer backend/.env si besoin

# 4. Créer la base de données
sudo -u postgres psql -c "CREATE DATABASE pekegno;"
sudo -u postgres psql -c "CREATE USER pekegno WITH PASSWORD 'pekegno_pass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE pekegno TO pekegno;"

# 5. Installer les dépendances
cd backend
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php composer install --no-interaction

# 6. Générer la clé
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan key:generate

# 7. Lancer les migrations
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan migrate --force

# 8. Lancer les seeders
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan db:seed --force

# 9. Générer Swagger
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan l5-swagger:generate --all

# 10. Démarrer le serveur
sudo docker run -d --rm -v "$PWD":/app -w /app --network=host \
  --name pekegno-server pekegno-php php artisan serve --port=8000
```

---

## Tester l'API

### Swagger UI

Ouvre http://127.0.0.1:8000/api/documentation

### Authentification

```bash
# Se connecter (admin par défaut)
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"email": "admin@pekegno.com", "password": "password"}'

# Voir son profil (token requis)
curl -s http://127.0.0.1:8000/api/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Se déconnecter
curl -s -X POST http://127.0.0.1:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

## Commandes utiles

```bash
# Arrêter le serveur
sudo docker rm -f pekegno-server

# Voir les logs
sudo docker logs pekegno-server

# Tinker (shell PHP interactif)
sudo docker run --rm -it -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan tinker

# Voir les routes
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan route:list

# Re-exécuter migrations + seeders
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan migrate:fresh --seed --force

# Voir les tables PostgreSQL
sudo -u postgres psql -d pekegno -c "\dt"
sudo -u postgres psql -d pekegno -c "\d users"
```

---

## API — Endpoints résumés

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/user` | Profil utilisateur |
| GET | `/api/users` | Lister utilisateurs (admin) |
| GET | `/api/users/{id}` | Voir un utilisateur |
| PUT | `/api/users/{id}` | Modifier un utilisateur |
| DELETE | `/api/users/{id}` | Supprimer un utilisateur |

---

### Seeders
| Fichier | Utilité |
|---|---|
| `database/seeders/PermissionSeeder.php` | Crée 9 permissions (creer, modifier, supprimer, exporter, consulter, imprimer, valider, encaisser, annuler) |
| `database/seeders/RoleSeeder.php` | Crée 8 rôles (super-admin, direction-generale, responsable-agence, responsable-departement, commercial, caissier, comptable, formateur) avec permissions associées |
| `database/seeders/AdminUserSeeder.php` | Crée admin@pekegno.com avec rôle super-admin |

### Routes
| Fichier | Modification |
|---|---|
| `routes/api.php` | Ajout de toutes les routes CRUD + assignation rôles/permissions |

---

## Tables PostgreSQL

| Table | Rôle |
|---|---|
| `users` | Utilisateurs (UUID, authentification, profil) |
| `agencies` | Agences |
| `departments` | Départements liés aux agences |
| `roles` | Rôles (super-admin, direction-generale, responsable-agence, responsable-departement, commercial, caissier, comptable, formateur) |
| `permissions` | Permissions (9 permissions) |
| `model_has_roles` | Association utilisateur ↔ rôle |
| `role_permission` | Association rôle ↔ permission |
| `user_assignments` | Association utilisateur ↔ agence |
| `personal_access_tokens` | Tokens Sanctum (auth API) |
| `login_logs` | Historique des connexions |
