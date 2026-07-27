# Modifications Frontend — PEKEGNO

> **Date** : 26 juillet 2026
> **Backend** : Laravel 13 · PHP 8.3 · PostgreSQL 16
> **Frontend** : React 19 · TypeScript · Tailwind v4 · Axios

---

## 1. Fichiers créés côté Frontend

### 1.1 Types

| Fichier | Description |
|---|---|
| `src/types/user.ts` | Types `UserListItem`, `UserListParams`, `UpdateUserPayload`, `RoleListItem`, `UserAssignment` |
| `src/types/auth.ts` | *(existait déjà)* — Types `Role`, `User`, `LoginCredentials`, etc. |
| `src/types/agency.ts` | *(modifié)* — Ajout `Department`, `AssignedUser`, `PaginatedResponse<T>`, `PaginationMeta`, `AgencyListParams` |

### 1.2 API Clients

| Fichier | Description |
|---|---|
| `src/api/users.api.ts` | CRUD utilisateurs : `list()`, `get()`, `update()`, `remove()`, `listRoles()`, `assignRole()` |
| `src/api/agencies.api.ts` | *(existait déjà)* — Ajout `trash()`, `restore()`, `forceDelete()` |

### 1.3 Pages

| Fichier | Description |
|---|---|
| `src/pages/users/UserListPage.tsx` | Liste paginée des utilisateurs + recherche + modales d'édition et attribution de rôle |

### 1.4 Composants

| Fichier | Description |
|---|---|
| `src/components/agencies/AgencyChiefAssignModal.tsx` | Modale pour assigner/retirer le chef d'agence |

### 1.5 Utils

| Fichier | Description |
|---|---|
| `src/utils/agencyPermissions.ts` | *(existait déjà)* — Fonctions `canCreateAgency`, `canEditAgency`, `canDeleteAgency`, `canManageTrash` |

### 1.6 Router

| Fichier | Description |
|---|---|
| `src/router/index.tsx` | *(modifié)* — Ajout route `/users` → `UserListPage` |

### 1.7 Sidebar

| Fichier | Description |
|---|---|
| `src/components/layout/Sidebar.tsx` | *(modifié)* — Ajout nav item "Utilisateurs" (`Users` icon de lucide-react) |

---

## 2. Fichiers modifiés côté Frontend

### 2.1 `src/types/agency.ts`

**Changements :**
- Ajout du type `Department` (id, name, code, agency_id, created_at, updated_at)
- Ajout du type `AssignedUser` avec `pivot` (department_id, is_primary)
- Ajout de `departments: Department[]` et `assigned_users: AssignedUser[]` dans `Agency`
- Ajout de `deleted_at: string | null` dans `Agency`
- Ajout des types `PaginationMeta`, `PaginatedResponse<T>`, `AgencyListParams`
- **Note** : Le champ `code` est auto-généré côté backend (AG001, AG002...), n'est pas dans le formulaire de création

### 2.2 `src/components/agencies/AgencyFormModal.tsx`

**Changements :**
- Suppression du champ "Code" du formulaire (auto-généré backend)
- Le formulaire ne contient que : name, country, city, address, phone, email
- `AgencyPayload` n'inclut plus `code`

### 2.3 `src/components/agencies/AgencyDetailModal.tsx`

**Changements :**
- Affichage de `agency.code` en lecture seule
- Affichage de `agency.departments` (avec `?.length ?? 0`)
- Affichage des `agency.assigned_users` avec badge "Chef" pour `pivot.is_primary === true`

### 2.4 `src/components/agencies/AgencyChiefAssignModal.tsx`

**Changement :**
- Modale nouvelle : charge les utilisateurs assignés depuis `/agencies/{id}`, propose de sélectionner un chef via `PUT /agencies/{id}/chief`

---

## 3. Routes API Backend (référence complète)

### 3.1 Auth

| Méthode | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Connexion | Non |
| POST | `/api/auth/register` | Inscription | Non |
| POST | `/api/auth/forgot-password` | Mot de passe oublié | Non |
| POST | `/api/auth/reset-password` | Réinitialisation | Non |
| POST | `/api/auth/logout` | Déconnexion | Oui |
| PUT | `/api/auth/change-password` | Changer le mot de passe | Oui |
| DELETE | `/api/auth/account` | Supprimer son compte | Oui |
| POST | `/api/auth/2fa/login` | Login 2FA | Non |
| POST | `/api/auth/2fa/enable` | Activer 2FA | Oui |
| POST | `/api/auth/2fa/verify` | Vérifier 2FA | Oui |
| POST | `/api/auth/2fa/disable` | Désactiver 2FA | Oui |

### 3.2 Profil

| Méthode | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/user` | Profil utilisateur connecté (retourne `UserResource`) | Oui |

### 3.3 Agences

| Méthode | Route | Description | Rôle requis |
|---|---|---|---|
| GET | `/api/agencies` | Liste paginée + recherche + tri | super-admin, direction-generale, responsable-agence |
| POST | `/api/agencies` | Créer (code auto-généré) | super-admin, direction-generale |
| GET | `/api/agencies/{id}` | Détail (departments + assigned_users chargés) | super-admin, direction-generale, responsable-agence |
| PUT | `/api/agencies/{id}` | Modifier | super-admin, direction-generale, responsable-agence (chef) |
| DELETE | `/api/agencies/{id}` | Soft delete (archiver) | super-admin |
| GET | `/api/agencies/trash` | Liste des agences supprimées | super-admin |
| POST | `/api/agencies/{id}/restore` | Restaurer | super-admin |
| DELETE | `/api/agencies/{id}/force-delete` | Suppression définitive | super-admin |

### 3.4 Chef d'agence

| Méthode | Route | Description |
|---|---|---|
| PUT | `/api/agencies/{agency}/chief` | Assigner un chef (body: `{ user_id }`) |
| DELETE | `/api/agencies/{agency}/chief` | Retirer le chef |

### 3.5 Départements

| Méthode | Route | Description | Rôle requis |
|---|---|---|---|
| GET | `/api/departments` | Liste paginée + recherche + filtre par agency_id | super-admin, direction-generale, responsable-agence |
| POST | `/api/departments` | Créer (body: `{ agency_id, name, description? }`) | super-admin, direction-generale, responsable-agence |
| GET | `/api/departments/{id}` | Détail | super-admin, direction-generale, responsable-agence |
| PUT | `/api/departments/{id}` | Modifier | super-admin, direction-generale, responsable-agence (chef) |
| DELETE | `/api/departments/{id}` | Soft delete | super-admin, direction-generale |
| GET | `/api/departments/trash` | Liste supprimés | super-admin, direction-generale, responsable-agence |
| POST | `/api/departments/{id}/restore` | Restaurer | super-admin |
| DELETE | `/api/departments/{id}/force-delete` | Suppression définitive | super-admin |

### 3.6 Utilisateurs

| Méthode | Route | Description | Rôle requis |
|---|---|---|---|
| GET | `/api/users` | Liste paginée + recherche | super-admin, direction-generale |
| GET | `/api/users/{id}` | Détail | super-admin, direction-generale |
| PUT | `/api/users/{id}` | Modifier (role, profil, is_active) | super-admin, direction-generale |
| DELETE | `/api/users/{id}` | Supprimer | super-admin, direction-generale (pas soi-même, pas dernier super-admin) |
| GET | `/api/users/{id}/role` | Rôle de l'utilisateur | super-admin, direction-generale |
| PUT | `/api/users/{id}/role` | Attribuer un rôle (body: `{ role_id }`) | super-admin, direction-generale |

### 3.7 Rôles

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/roles` | Tous les rôles disponibles |

### 3.8 Catégories

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/categories` | Liste |
| POST | `/api/categories` | Créer |
| GET | `/api/categories/{id}` | Détail |
| PUT | `/api/categories/{id}` | Modifier |
| DELETE | `/api/categories/{id}` | Supprimer |

---

## 4. Structure du modèle de données (MCD/MLD)

### Tables principales

```
roles (id, name, description, created_at, updated_at)

users (id, username, email, password, first_name, last_name, phone,
       role_id → roles.id, is_active, two_factor_enabled, two_factor_secret,
       remember_token, is_password_change_required, last_login_at,
       created_at, updated_at)

agencies (id, code, name, country, city, address, phone, email,
          created_at, updated_at, deleted_at)

departments (id, agency_id → agencies.id, name, description,
             created_at, updated_at, deleted_at)

categories (id, name, description, color, icon, created_at, updated_at)

user_assignments (user_id → users.id, agency_id → agencies.id,
                  department_id → departments.id (nullable),
                  is_primary, created_at, updated_at)
```

### Relations clés

- **Chef d'agence** = `user_assignments.is_primary = true` (pas de colonne `chief_id` sur agencies)
- Un chef peut gérer **plusieurs agences**
- Une agence a **un seul chef** (is_primary = true)
- Les départements ont soft deletes (`deleted_at`)

---

## 5. Ce qu'il reste à faire côté Frontend

### 5.1 Page Départements (à créer)

**Fichier à créer :** `src/pages/departments/DepartmentListPage.tsx`

**API client à créer :** `src/api/departments.api.ts`

**Types à ajouter dans** `src/types/department.ts` :

```typescript
export interface Department {
  id: string;
  name: string;
  description: string | null;
  agency_id: string;
  agency?: Agency; //chargé via Resource
  created_at: string;
  updated_at: string;
}

export interface DepartmentListParams {
  search?: string;
  agency_id?: string;
  per_page?: number;
  page?: number;
}

export interface DepartmentPayload {
  agency_id: string;
  name: string;
  description?: string;
}
```

**Endpoints API à appeler :**

```typescript
// departments.api.ts
import { client } from './client';
import type { Department, DepartmentListParams, DepartmentPayload } from '@/types/department';
import type { PaginatedResponse } from '@/types/agency';

export const departmentsApi = {
  async list(params: DepartmentListParams = {}): Promise<PaginatedResponse<Department>> {
    const { data } = await client.get<PaginatedResponse<Department>>('/departments', { params });
    return data;
  },
  async get(id: string): Promise<Department> {
    const { data } = await client.get<{ data: Department }>(`/departments/${id}`);
    return data.data;
  },
  async create(payload: DepartmentPayload): Promise<Department> {
    const { data } = await client.post<{ data: Department }>('/departments', payload);
    return data.data;
  },
  async update(id: string, payload: Partial<DepartmentPayload>): Promise<Department> {
    const { data } = await client.put<{ data: Department }>(`/departments/${id}`, payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await client.delete(`/departments/${id}`);
  },
  async trash(params: DepartmentListParams = {}): Promise<PaginatedResponse<Department>> {
    const { data } = await client.get<PaginatedResponse<Department>>('/departments/trash', { params });
    return data;
  },
  async restore(id: string): Promise<Department> {
    const { data } = await client.post<{ data: Department }>(`/departments/${id}/restore`);
    return data.data;
  },
  async forceDelete(id: string): Promise<void> {
    await client.delete(`/departments/${id}/force-delete`);
  },
};
```

**Routes à ajouter dans** `src/router/index.tsx` :

```tsx
import DepartmentListPage from '@/pages/departments/DepartmentListPage';
import DepartmentTrashPage from '@/pages/departments/DepartmentTrashPage';

// Dans le children de AppLayout :
{ path: '/departments', element: <DepartmentListPage /> },
{ path: '/departments/trash', element: <DepartmentTrashPage /> },
```

**Sidebar :** Ajouter un item "Départements" avec l'icone `FolderTree` de lucide-react

**Permissions à créer :** `src/utils/departmentPermissions.ts` — refléter `DepartmentPolicy.php`

**Fonctions à implémenter :**

```typescript
export function canViewDepartments(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(user?.role?.name ?? '');
}

export function canCreateDepartment(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(user?.role?.name ?? '');
}

export function canEditDepartment(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(user?.role?.name ?? '');
}

export function canDeleteDepartment(user: User | null): boolean {
  return ['super-admin', 'direction-generale'].includes(user?.role?.name ?? '');
}

export function canManageDepartmentTrash(user: User | null): boolean {
  return user?.role?.name === 'super-admin';
}
```

### 5.2 Page Corbeille Départements (à créer)

**Fichier :** `src/pages/departments/DepartmentTrashPage.tsx`
- Même structure que `AgencyTrashPage.tsx`
- Appeler `departmentsApi.trash()`, `departmentsApi.restore()`, `departmentsApi.forceDelete()`
- Route : `/departments/trash`

### 5.3 Améliorations à prévoir

| Module | Amélioration | Priorité |
|---|---|---|
| Users | Ajouter un bouton "Supprimer" dans la colonne Actions de `UserListPage` | Moyenne |
| Users | Ajouter un toggle `is_active` directement dans le tableau (switch) | Basse |
| Agencies | Afficher le nom du chef d'agence dans la colonne dédiée du tableau | Moyenne |
| Departments | Ajouter un filtre dropdown par agence (au lieu d'un simple champ texte) | Moyenne |
| Dashboard | Créer une vraie page Dashboard avec stats (agences, users, départements) | Haute |
| Categories | Créer la page CRUD catégories (API déjà prête) | Moyenne |
| Profile | Ajouter la section "Changer le mot de passe" dans la page profil | Basse |

---

## 6. Rôles disponibles

| Slug | Description |
|---|---|
| `super-admin` | Administrateur système — accès total |
| `direction-generale` | Direction générale — gestion des agences/départements/utilisateurs |
| `responsable-agence` | Chef d'agence — gère son agence et ses départements |
| `responsable-departement` | Chef de département |
| `commercial` | Commercial |
| `caissier` | Caissier |
| `comptable` | Comptable |
| `formateur` | Formateur |

---

## 7. Notes techniques importantes

### 7.1 Format des réponses paginées

Toutes les listes paginées retournent :

```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 72
  },
  "links": {
    "first": "...",
    "last": "...",
    "prev": null,
    "next": "..."
  }
}
```

Le type `PaginatedResponse<T>` dans `src/types/agency.ts` couvre déjà cette structure.

### 7.2 Validation côté backend

Les erreurs de validation retournent :

```json
{
  "message": "Erreur de validation",
  "errors": {
    "field_name": ["Message d'erreur 1"]
  }
}
```

Utiliser `extractFieldErrors()` depuis `src/api/errors.ts` pour parser.

### 7.3 Auth et token

- Token stocké dans localStorage (`pekegno_token`)
- Header `Authorization: Bearer {token}` ajouté automatiquement par `client.ts`
- 401 → clear token + redirection `/login`
- 403 → toast "Accès refusé"
