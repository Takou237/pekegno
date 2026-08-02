# Guide de test PEKEGNO — Swagger UI + curl

## Prérequis

```bash
# Allumer le serveur
cd backend
sudo docker run -d --rm -v "$PWD":/app -w /app --network=host \
  --name pekegno-server pekegno-php php artisan serve --port=8000

# Arrêter le serveur
sudo docker rm -f pekegno-server
```

---

## 1. Swagger UI (interface interactive)

Ouvrir http://127.0.0.1:8000/api/documentation

- Cliquer **Authorize** en haut à droite
- Tester d'abord un login, récupérer le token
- Coller le token (sans les guillemets) dans le champ `Value` et cliquer Authorize
- Tous les endpoints protégés seront débloqués

---

## 2. Authentification (curl)

```bash
# Se connecter (admin par défaut)
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"email": "admin@pekegno.com", "password": "password"}' | json_pp

# Récupérer le token automatiquement
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"email": "admin@pekegno.com", "password": "password"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: $TOKEN"
```

---

## 3. Profil

```bash
curl -s http://127.0.0.1:8000/api/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" | json_pp
```

---

## 4. Rôles

```bash
# Lister
curl -s http://127.0.0.1:8000/api/roles \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Créer
curl -s -X POST http://127.0.0.1:8000/api/roles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "editor", "description": "Éditeur de contenu"}' | json_pp

# Voir un rôle (remplacer {id})
curl -s http://127.0.0.1:8000/api/roles/{id} \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Modifier
curl -s -X PUT http://127.0.0.1:8000/api/roles/{id} \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"description": "Nouvelle description"}' | json_pp

# Supprimer
curl -s -X DELETE http://127.0.0.1:8000/api/roles/{id} \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json"

# Supprimer un rôle système → erreur 403
curl -s -X DELETE http://127.0.0.1:8000/api/roles/{id-du-super-admin} \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json"
```

---

## 5. Permissions

```bash
# Lister (24 permissions)
curl -s http://127.0.0.1:8000/api/permissions \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Créer
curl -s -X POST http://127.0.0.1:8000/api/permissions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name": "reports.view", "label": "Voir les rapports", "group": "reports"}' | json_pp

# Voir / Modifier / Supprimer
curl -s http://127.0.0.1:8000/api/permissions/{id} ...
curl -s -X PUT http://127.0.0.1:8000/api/permissions/{id} ...
curl -s -X DELETE http://127.0.0.1:8000/api/permissions/{id} ...
```

---

## 6. Agences

```bash
# Lister
curl -s http://127.0.0.1:8000/api/agencies \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Créer
curl -s -X POST http://127.0.0.1:8000/api/agencies \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"code":"AG-001","name":"Agence Paris","country":"France","city":"Paris"}' | json_pp

# Créer une 2e agence
curl -s -X POST http://127.0.0.1:8000/api/agencies \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"code":"AG-002","name":"Agence Lyon","country":"France","city":"Lyon"}' | json_pp

# Voir / Modifier / Supprimer
curl -s http://127.0.0.1:8000/api/agencies/{id} ...
curl -s -X PUT http://127.0.0.1:8000/api/agencies/{id} ...
curl -s -X DELETE http://127.0.0.1:8000/api/agencies/{id} ...
```

---

## 7. Départements

```bash
# Créer (besoin d'un agency_id)
AGENCY_ID=$(curl -s http://127.0.0.1:8000/api/agencies \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -s -X POST http://127.0.0.1:8000/api/departments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"agency_id\":\"$AGENCY_ID\",\"name\":\"Service Commercial\"}" | json_pp

# Lister
curl -s http://127.0.0.1:8000/api/departments \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp
```

---

## 8. Utilisateurs (admin)

```bash
# Lister (avec pagination et recherche)
curl -s "http://127.0.0.1:8000/api/users?search=admin&per_page=10" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Lister tous
curl -s "http://127.0.0.1:8000/api/users" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Voir un utilisateur (avec rôles, agences)
USER_ID=$(curl -s http://127.0.0.1:8000/api/user \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s "http://127.0.0.1:8000/api/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Modifier
curl -s -X PUT "http://127.0.0.1:8000/api/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"first_name": "Super", "last_name": "Admin"}' | json_pp
```

---

## 9. Assigner des rôles aux utilisateurs

```bash
# Récupérer l'ID d'un rôle (ex: "user")
ROLE_USER=$(curl -s http://127.0.0.1:8000/api/roles \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  | grep -B1 '"name":"user"' | grep '"id"' | cut -d'"' -f4)

# Récupérer un utilisateur
USER_ID=019f4ac7-f76c-7393-937b-5d60d51edd17  # <= remplace par un vrai ID

# Assigner le rôle "user"
curl -s -X POST "http://127.0.0.1:8000/api/users/$USER_ID/roles" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"role_id\":\"$ROLE_USER\"}" | json_pp

# Lister les rôles de l'utilisateur
curl -s "http://127.0.0.1:8000/api/users/$USER_ID/roles" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp

# Retirer un rôle
curl -s -X DELETE "http://127.0.0.1:8000/api/users/$USER_ID/roles/$ROLE_USER" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json"
```

---

## 10. Assigner des permissions à un rôle

```bash
# Récupérer l'ID du rôle "user"
ROLE_USER=$(curl -s http://127.0.0.1:8000/api/roles \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  | grep -B1 '"name":"user"' | grep '"id"' | cut -d'"' -f4)

# Récupérer des IDs de permissions
PERM_IDS=$(curl -s http://127.0.0.1:8000/api/permissions \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
  | grep -o '"id":"[^"]*"' | head -4 | cut -d'"' -f4 | paste -sd ',' | sed 's/,/","/g')

# Assigner les 4 premières permissions au rôle "user"
curl -s -X POST "http://127.0.0.1:8000/api/roles/$ROLE_USER/permissions" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"permissions\":[\"$PERM_IDS\"]}" | json_pp

# Lister les permissions du rôle
curl -s "http://127.0.0.1:8000/api/roles/$ROLE_USER/permissions" \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" | json_pp
```

---

## 11. Test de déconnexion

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/json"
```

---

## Résumé des endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/user` | Profil connecté |
| GET | `/api/users` | Lister utilisateurs |
| GET | `/api/users/{id}` | Voir un utilisateur |
| PUT | `/api/users/{id}` | Modifier un utilisateur |
| DELETE | `/api/users/{id}` | Supprimer un utilisateur |
| GET | `/api/roles` | Lister rôles |
| POST | `/api/roles` | Créer un rôle |
| GET | `/api/roles/{id}` | Voir un rôle |
| PUT | `/api/roles/{id}` | Modifier un rôle |
| DELETE | `/api/roles/{id}` | Supprimer un rôle |
| GET | `/api/permissions` | Lister permissions |
| POST | `/api/permissions` | Créer une permission |
| GET | `/api/permissions/{id}` | Voir une permission |
| PUT | `/api/permissions/{id}` | Modifier une permission |
| DELETE | `/api/permissions/{id}` | Supprimer une permission |
| GET | `/api/agencies` | Lister agences |
| POST | `/api/agencies` | Créer une agence |
| GET | `/api/agencies/{id}` | Voir une agence |
| PUT | `/api/agencies/{id}` | Modifier une agence |
| DELETE | `/api/agencies/{id}` | Supprimer une agence |
| GET | `/api/departments` | Lister départements |
| POST | `/api/departments` | Créer un département |
| GET | `/api/departments/{id}` | Voir un département |
| PUT | `/api/departments/{id}` | Modifier un département |
| DELETE | `/api/departments/{id}` | Supprimer un département |
| GET | `/api/users/{id}/roles` | Rôles d'un utilisateur |
| POST | `/api/users/{id}/roles` | Assigner un rôle |
| DELETE | `/api/users/{id}/roles/{id}` | Retirer un rôle |
| GET | `/api/roles/{id}/permissions` | Permissions d'un rôle |
| POST | `/api/roles/{id}/permissions` | Assigner des permissions |

---

## Données initiales (seeders)

**Compte admin :** `admin@pekegno.com` / `password` (rôle super-admin)

**Permissions pré-créées :** 9 (creer, modifier, supprimer, exporter, consulter, imprimer, valider, encaisser, annuler)

**Rôles pré-créés :** super-admin (9 perms), direction-generale (9 perms), responsable-agence (8 perms), responsable-departement (8 perms), commercial (5 perms), caissier (3 perms), comptable (4 perms), formateur (3 perms)
