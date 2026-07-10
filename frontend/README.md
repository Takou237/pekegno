# PEKEGNO — Frontend

React + Vite + TypeScript + Tailwind CSS v4, dans l'esprit visuel de [TailAdmin React](https://tailadmin.com/react) (palette, typographie Outfit, composants).

Livré : **Jour 1** (socle) et **Jour 2** (authentification) du plan d'exécution.

## Stack

- React 18 + TypeScript
- Vite 6 (+ proxy dev vers `http://localhost:8000` pour éviter les soucis CORS avec le backend Laravel)
- Tailwind CSS v4 (`@theme` dans `src/index.css`, pas de `tailwind.config.js` séparé)
- React Router v6
- Axios (client + intercepteurs)
- Auth par token Bearer (Laravel Sanctum, côté Dev1)

## Installation

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

L'app démarre sur `http://localhost:5173`. En dev, toute requête vers `/api/*` est automatiquement proxyfiée vers `http://localhost:8000` (voir `vite.config.ts`), donc `VITE_API_URL` peut rester tel quel ou être vidé.

## Structure

```
src/
├── api/            # client axios + appels auth (auth.api.ts) + gestion erreurs Laravel
├── components/
│   ├── ui/         # atomes : Button, Input, Alert
│   └── auth/       # LoginForm, RegisterForm, TwoFactorForm
├── context/         # AuthContext (session courante, token, user)
├── hooks/          # useAuth, useInactivityLogout
├── layouts/        # AuthLayout (écran de connexion/inscription/2FA)
├── pages/auth/     # LoginPage, RegisterPage, TwoFactorPage
├── router/         # index (routes), ProtectedRoute, GuestRoute
└── types/auth.ts   # types alignés sur app/Models/User.php (Dev1)
```

## Points d'attention / à synchroniser avec Dev1

1. **2FA** : `POST /auth/login` ne renvoie aujourd'hui que `{ user, token }`, sans vérifier `two_factor_enabled`, et il n'existe pas encore de route `/auth/two-factor/verify`. Le front est câblé sur un contrat proposé (voir commentaire dans `types/auth.ts`) :
   ```json
   { "requires_two_factor": true, "two_factor_token": "..." }
   ```
   Tant que ce n'est pas implémenté côté API, un utilisateur avec `two_factor_enabled = true` se connectera directement (le front ne peut pas détecter le besoin de 2FA si l'API ne le signale pas). **Action Jour 3+ : Dev1 à valider/ajuster ce contrat.**
2. **Refresh token** : Sanctum ne fournit pas de refresh token natif. Le front réagit aux `401` (token révoqué par `EnsureSingleSession`, session expirée...) en nettoyant la session et en redirigeant vers `/login`. `useInactivityLogout` ajoute une déconnexion côté client après inactivité (durée alignée sur `SESSION_LIFETIME`), en complément du middleware `InactivityLogout` du backend (créé par Dev1 mais pas encore branché sur les routes API dans `bootstrap/app.php`).
3. **Store d'état** : `structure_complete.md` prévoyait un `store/auth.store.ts` (Zustand). J'ai utilisé un `AuthContext` React à la place (zéro dépendance en plus, suffisant pour l'auth seule). À partir du Jour 4 (agences, départements...), si on préfère rester strictement aligné avec le plan (`agency.store.ts`, `ui.store.ts`), on peut soit généraliser Zustand pour tout le monde, soit garder Context pour l'auth et Zustand pour le reste — à trancher en équipe.

## Prochaine étape (Jour 3, Dev2)

Pages Rôles/Permissions (`RoleList`, `RoleForm`, `PermissionList`) + `usePermissions.ts` + `RoleRoute.tsx`, en s'appuyant sur les endpoints déjà livrés par Dev1 (`/roles`, `/permissions`, `/roles/{role}/permissions`).
