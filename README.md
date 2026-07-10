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

# S'inscrire
curl -s -X POST http://127.0.0.1:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "username": "monuser",
    "email": "monuser@email.com",
    "password": "password",
    "password_confirmation": "password",
    "first_name": "Jean",
    "last_name": "Dupont"
  }'

# Voir son profil (token requis)
curl -s http://127.0.0.1:8000/api/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Se déconnecter
curl -s -X POST http://127.0.0.1:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### CRUD Rôles (token admin requis)

```bash
# Lister les rôles
curl -s http://127.0.0.1:8000/api/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Créer un rôle
curl -s -X POST http://127.0.0.1:8000/api/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "editor", "description": "Éditeur de contenu"}'

# Voir un rôle
curl -s http://127.0.0.1:8000/api/roles/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Modifier un rôle
curl -s -X PUT http://127.0.0.1:8000/api/roles/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"description": "Nouvelle description"}'

# Supprimer un rôle
curl -s -X DELETE http://127.0.0.1:8000/api/roles/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### CRUD Permissions

```bash
# Lister
curl -s http://127.0.0.1:8000/api/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Créer
curl -s -X POST http://127.0.0.1:8000/api/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "reports.view", "label": "Voir les rapports", "group": "reports"}'
```

### CRUD Agences

```bash
# Lister
curl -s http://127.0.0.1:8000/api/agencies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Créer
curl -s -X POST http://127.0.0.1:8000/api/agencies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "code": "AG-001",
    "name": "Agence Paris",
    "country": "France",
    "city": "Paris"
  }'
```

### CRUD Départements

```bash
# Lister
curl -s http://127.0.0.1:8000/api/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Créer (agency_id requis)
curl -s -X POST http://127.0.0.1:8000/api/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"agency_id": "{id}", "name": "Service Commercial"}'
```

### CRUD Catégories

```bash
# Lister
curl -s http://127.0.0.1:8000/api/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Créer
curl -s -X POST http://127.0.0.1:8000/api/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "Formation", "color": "#3B82F6", "icon": "book"}'
```

### CRUD Utilisateurs (admin)

```bash
# Lister (avec pagination, filtres)
curl -s "http://127.0.0.1:8000/api/users?search=john&is_active=true&per_page=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Voir un utilisateur (avec rôles, agences)
curl -s http://127.0.0.1:8000/api/users/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Modifier un utilisateur
curl -s -X PUT http://127.0.0.1:8000/api/users/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"first_name": "Nouveau", "is_active": true}'

# Supprimer
curl -s -X DELETE http://127.0.0.1:8000/api/users/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### Assigner des rôles aux utilisateurs

```bash
# Assigner un rôle
curl -s -X POST http://127.0.0.1:8000/api/users/{user_id}/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"role_id": "{role_id}"}'

# Lister les rôles d'un utilisateur
curl -s http://127.0.0.1:8000/api/users/{user_id}/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"

# Retirer un rôle
curl -s -X DELETE http://127.0.0.1:8000/api/users/{user_id}/roles/{role_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### Assigner des permissions aux rôles

```bash
# Assigner des permissions à un rôle
curl -s -X POST http://127.0.0.1:8000/api/roles/{role_id}/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"permissions": ["{perm_id_1}", "{perm_id_2}"]}'

# Lister les permissions d'un rôle
curl -s http://127.0.0.1:8000/api/roles/{role_id}/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

---

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
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/user` | Profil utilisateur |
| GET | `/api/users` | Lister utilisateurs (admin) |
| GET | `/api/users/{id}` | Voir un utilisateur |
| PUT | `/api/users/{id}` | Modifier un utilisateur |
| DELETE | `/api/users/{id}` | Supprimer un utilisateur |
| GET/POST/PUT/DELETE | `/api/roles` | CRUD rôles |
| GET/POST/PUT/DELETE | `/api/permissions` | CRUD permissions |
| GET/POST/PUT/DELETE | `/api/agencies` | CRUD agences |
| GET/POST/PUT/DELETE | `/api/departments` | CRUD départements |
| GET/POST/PUT/DELETE | `/api/categories` | CRUD catégories |
| GET/POST/DELETE | `/api/users/{id}/roles` | Gérer rôles utilisateur |
| GET/POST | `/api/roles/{id}/permissions` | Gérer permissions d'un rôle |

---

## Fichiers créés / modifiés

### Migrations
| Fichier | Utilité |
|---|---|
| `database/migrations/2026_07_10_000001_create_role_permission_table.php` | Pivot rôle ↔ permission |
| `database/migrations/2026_07_10_000002_create_model_has_roles_table.php` | Pivot polymorphic modèle ↔ rôle |
| `database/migrations/2026_07_10_000003_create_user_assignments_table.php` | Pivot utilisateur ↔ agence |

### Form Requests
| Fichier | Utilité |
|---|---|
| `app/Http/Requests/Api/StoreRoleRequest.php` | Validation création rôle |
| `app/Http/Requests/Api/UpdateRoleRequest.php` | Validation modification rôle |
| `app/Http/Requests/Api/StorePermissionRequest.php` | Validation création permission |
| `app/Http/Requests/Api/UpdatePermissionRequest.php` | Validation modification permission |
| `app/Http/Requests/Api/StoreAgencyRequest.php` | Validation création agence |
| `app/Http/Requests/Api/UpdateAgencyRequest.php` | Validation modification agence |
| `app/Http/Requests/Api/StoreDepartmentRequest.php` | Validation création département |
| `app/Http/Requests/Api/UpdateDepartmentRequest.php` | Validation modification département |
| `app/Http/Requests/Api/StoreCategoryRequest.php` | Validation création catégorie |
| `app/Http/Requests/Api/UpdateCategoryRequest.php` | Validation modification catégorie |
| `app/Http/Requests/Api/AssignRoleRequest.php` | Validation assignation rôle |
| `app/Http/Requests/Api/AssignPermissionRequest.php` | Validation assignation permissions |

### Controllers
| Fichier | Utilité |
|---|---|
| `app/Http/Controllers/Api/RoleController.php` | CRUD rôles |
| `app/Http/Controllers/Api/PermissionController.php` | CRUD permissions |
| `app/Http/Controllers/Api/AgencyController.php` | CRUD agences |
| `app/Http/Controllers/Api/DepartmentController.php` | CRUD départements |
| `app/Http/Controllers/Api/CategoryController.php` | CRUD catégories |
| `app/Http/Controllers/Api/UserController.php` | CRUD utilisateurs (admin) |
| `app/Http/Controllers/Api/UserRoleController.php` | Assigner/retirer/lister rôles d'un utilisateur |
| `app/Http/Controllers/Api/RolePermissionController.php` | Assigner/lister permissions d'un rôle |

### Seeders
| Fichier | Utilité |
|---|---|
| `database/seeders/PermissionSeeder.php` | Crée 24 permissions (users, roles, permissions, agencies, departments, categories) |
| `database/seeders/RoleSeeder.php` | Crée 4 rôles (super-admin, admin, manager, user) avec permissions associées |
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
| `categories` | Catégories |
| `roles` | Rôles (super-admin, admin, manager, user) |
| `permissions` | Permissions (24 permissions) |
| `model_has_roles` | Association utilisateur ↔ rôle |
| `role_permission` | Association rôle ↔ permission |
| `user_assignments` | Association utilisateur ↔ agence |
| `personal_access_tokens` | Tokens Sanctum (auth API) |
| `login_logs` | Historique des connexions |
