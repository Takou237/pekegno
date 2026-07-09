# PEKEGNO

Plateforme multi-agence SaaS (CRM, Formations, Facturation, Comptabilité).

## Stack

- **Backend** : Laravel 13 + PHP 8.3 (Docker)
- **Base de données** : PostgreSQL 12 (local)
- **Frontend** : React + Vite + Tailwind (à venir)

---

## Installation pour un nouveau développeur

### 1. Cloner le projet

```bash
git clone <url-du-repo> pekegno
cd pekegno
```

### 2. Construire l'image Docker PHP

```bash
sudo docker build -t pekegno-php docker/php/
```

### 3. Configurer l'environnement

```bash
cp backend/.env.example backend/.env
```

Éditer `backend/.env` si besoin (BDD, etc.).

### 4. Créer la base de données PostgreSQL

```bash
sudo -u postgres psql -c "CREATE DATABASE pekegno;"
sudo -u postgres psql -c "CREATE USER pekegno WITH PASSWORD 'pekegno_pass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE pekegno TO pekegno;"
```

### 5. Installer les dépendances + générer la clé

```bash
cd backend

sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php composer install --no-interaction

sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan key:generate
```

### 6. Lancer les migrations

```bash
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan migrate --force
```

### 7. Générer la doc Swagger

```bash
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan l5-swagger:generate --all
```

### 8. Démarrer le serveur de test

```bash
sudo docker run -d --rm -v "$PWD":/app -w /app --network=host \
  --name pekegno-server pekegno-php php artisan serve --port=8000
```

### 9. Tester

- **Swagger UI** : http://127.0.0.1:8000/api/documentation
- **Login** : `POST /api/auth/login` (email: `admin@pekegno.com`, password: `password`)
- **Inscription** : `POST /api/auth/register`

---

## Commandes utiles

```bash
# Arrêter le serveur
sudo docker rm -f pekegno-server

# Voir les logs du serveur
sudo docker logs pekegno-server

# Lancer Tinker
sudo docker run --rm -it -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan tinker

# Voir les routes
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan route:list

# Composer
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php composer <commande>

# Artisan
sudo docker run --rm -v "$PWD":/app -w /app --network=host \
  pekegno-php php artisan <commande>
```

---

## Architecture

```
docker/php/Dockerfile    Image PHP 8.3 avec pdo_pgsql, zip, Composer
backend/                 Projet Laravel
  app/
    Models/              Modèles (User, Agency, Department, Category, Role, Permission, LoginLog)
    Services/            Logique métier (AuthService)
    Http/
      Controllers/Api/   Contrôleurs API
      Middleware/         Middlewares (EnsureSingleSession, InactivityLogout)
  database/
    migrations/          Migrations des tables
  routes/
    api.php              Routes API
  config/                Configuration
docker-compose.yml       Services Docker (optionnel)
```
