# PEKEGNO Client — Site client & espace client

Application frontend distincte pour la **boutique publique** et l'**espace client** de PEKEGNO.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- react-router-dom v6
- axios (client HTTP)
- i18next / react-i18next (FR / EN)

## Structure

```
src/
  api/          # Client HTTP + modules API (public, auth, client)
  components/   # UI atoms + common (ToastContainer)
  context/      # AuthContext, ToastContext
  i18n/         # Traductions fr/en
  layouts/      # PublicLayout (site), AccountLayout (espace client)
  pages/
    public/     # Accueil, Catalogue, Fiche produit, Connexion, Inscription, Mot de passe oublié
    account/    # Dashboard, Commandes, Factures, Formations, Fiche apprenant, Profil
  router/       # createBrowserRouter + guards (ProtectedRoute, GuestRoute)
  types/        # Types TypeScript
```

## Développement

```bash
npm install
npm run dev        # Port 5174, proxy /api → localhost:8000
npm run build
```

## Configuration

Seul fichier `.env` nécessaire :

```bash
# VITE_API_URL=https://pekegno-backend.onrender.com/api   # par défaut: /api
```

## Déploiement (Vercel)

Le fichier `vercel.json` configure :
- Rewrite `/api/*` vers le backend Laravel (Render)
- Rewrite `/storage/*` vers les fichiers uploadés
- Fallback SPA vers `index.html`

## Endpoints consommés

- **Public (non auth)** : `/api/public/countries`, `/agencies`, `/services`, `/products`, `/agencies/{id}/payment-methods`
- **Espace client (`portal:client`)** : `/api/client/orders`, `/checkout`, `/invoices`, `/invoices/{id}/payment-proof`, `/enrollments`, `/learner-profile`, `/attendances`, `/observations`
