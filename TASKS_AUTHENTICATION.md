# 🔐 Module Authentification — Tâches Détaillées

> **Projet :** PEKEGNO — Plateforme Multi-Agences
> **Dernière mise à jour :** 2026-07-14
> **Statut global :** 6/27 tâches terminées

---

## BACKEND

### B1 — Connexion (Login)
**Statut :** ✅ DONE
**Endpoint :** `POST /api/auth/login`
**Fichiers :** `LoginController.php`, `LoginRequest.php`, `AuthService.php`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Valider email + mot de passe via `LoginRequest` | ✅ |
| 2 | Vérifier existence de l'utilisateur par email | ✅ |
| 3 | Vérifier correspondance du mot de passe (`Hash::check`) | ✅ |
| 4 | Vérifier que le compte est actif (`is_active = true`) | ✅ |
| 5 | Générer un token Sanctum (`createToken`) | ✅ |
| 6 | Logger la connexion dans `login_logs` (action, IP, user_agent) | ✅ |
| 7 | Mettre à jour `last_login_at` et `last_login_ip` | ✅ |
| 8 | Retourner `user` (avec rôle eager-loaded) + `token` | ✅ |
| 9 | Gérer les échecs : identifiants incorrects → 422 | ✅ |
| 10 | Gérer les échecs : compte désactivé → 422 | ✅ |

---

### B2 — Inscription (Register)
**Statut :** ✅ DONE
**Endpoint :** `POST /api/auth/register`
**Fichiers :** `RegisterController.php`, `RegisterRequest.php`, `AuthService.php`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Valider : username (unique), email (unique), password (min:8, confirmed) | ✅ |
| 2 | Valider : first_name, last_name, phone (optionnels) | ✅ |
| 3 | Créer l'utilisateur avec mot de passe hashé | ✅ |
| 4 | Attribuer le rôle par défaut (`user`) | ❌ À vérifier |
| 5 | Générer un token Sanctum | ✅ |
| 6 | Logger l'inscription dans `login_logs` | ✅ |
| 7 | Retourner `user` + `token` (201) | ✅ |

---

### B3 — Déconnexion (Logout)
**Statut :** ✅ DONE
**Endpoint :** `POST /api/auth/logout` (auth:sanctum)
**Fichiers :** `LogoutController.php`, `AuthService.php`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Supprimer le token Sanctum courant (`currentAccessToken()->delete()`) | ✅ |
| 2 | Logger la déconnexion dans `login_logs` | ✅ |
| 3 | Retourner message de confirmation (200) | ✅ |

---

### B4 — Profil utilisateur connecté
**Statut :** ✅ DONE
**Endpoint :** `GET /api/user` (auth:sanctum)
**Fichiers :** `ProfileController.php`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Récupérer l'utilisateur courant via `$request->user()` | ✅ |
| 2 | Retourner les données complètes (rôle eager-loaded) | ✅ |

---

### B5 — Demande de réinitialisation de mot de passe (Forgot Password)
**Statut :** ❌ À FAIRE
**Endpoint :** `POST /api/auth/forgot-password`
**Fichiers à créer :** `ForgotPasswordRequest.php`, `ForgotPasswordController.php`
**Complexité :** Moyenne

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Créer `ForgotPasswordRequest` : valider `email` (required, email, exists:users) | ❌ |
| 2 | Créer `ForgotPasswordController` | ❌ |
| 3 | Générer un token de réinitialisation (`DB::table('password_reset_tokens')->insert`) | ❌ |
| 4 | Envoyer un email avec le lien de réinitialisation (`Mail::to`) | ❌ |
| 5 | Retourner toujours 200 avec message générique (éviter l'énumération d'emails) | ❌ |
| 6 | Ajouter la route dans `api.php` (publique, pas de middleware auth) | ❌ |
| 7 | Ajouter les tests | ❌ |

**Note :** La table `password_reset_tokens` existe déjà par défaut dans Laravel (migration `0001_01_01_000001`).

---

### B6 — Réinitialisation de mot de passe (Reset Password)
**Statut :** ❌ À FAIRE
**Endpoint :** `POST /api/auth/reset-password`
**Fichiers à créer :** `ResetPasswordRequest.php`, `ResetPasswordController.php`
**Dépendance :** B5
**Complexité :** Moyenne

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Créer `ResetPasswordRequest` : valider `token`, `email`, `password` (min:8, confirmed) | ❌ |
| 2 | Vérifier la validité du token dans `password_reset_tokens` (hash + expiry) | ❌ |
| 3 | Mettre à jour le mot de passe de l'utilisateur | ❌ |
| 4 | Supprimer le token utilisé de `password_reset_tokens` | ❌ |
| 5 | Révoquer **tous** les tokens Sanctum de l'utilisateur (forcer reconnexion) | ❌ |
| 6 | Logger l'événement dans `login_logs` (action: `password_reset`) | ❌ |
| 7 | Retourner message de succès | ❌ |
| 8 | Ajouter la route dans `api.php` (publique) | ❌ |

---

### B7 — Changement de mot de passe (utilisateur connecté)
**Statut :** ❌ À FAIRE
**Endpoint :** `PUT /api/auth/change-password`
**Fichiers à créer :** `ChangePasswordRequest.php`, modification de `AuthController` ou nouveau contrôleur
**Complexité :** Faible

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Créer `ChangePasswordRequest` : valider `current_password` (required), `password` (min:8, confirmed) | ❌ |
| 2 | Vérifier que `current_password` correspond au mot de passe actuel (`Hash::check`) | ❌ |
| 3 | Mettre à jour le mot de passe | ❌ |
| 4 | Révoquer tous les tokens Sanctum **sauf** le courant (reconnexion forcée ailleurs) | ❌ |
| 5 | Logger l'événement dans `login_logs` (action: `password_changed`) | ❌ |
| 6 | Retourner message de succès | ❌ |
| 7 | Ajouter la route dans `api.php` (auth:sanctum) | ❌ |
| 8 | Ajouter les tests | ❌ |

---

### B8 — 2FA — Activation (génération du secret)
**Statut :** ❌ À FAIRE
**Endpoint :** `POST /api/auth/2fa/enable`
**Fichiers à créer :** `TwoFactorController.php`
**Dépendance :** Nécessite une colonne `two_factor_secret` sur `users` (ou table dédiée)
**Complexité :** Élevée

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Installer une librairie TOTP (`pragmarx/google2fa-laravel` ou équivalent) | ❌ |
| 2 | Créer la migration pour ajouter `two_factor_secret` (nullable, text) sur `users` | ❌ |
| 3 | Générer un secret TOTP (`$google2fa->generateSecretKey()`) | ❌ |
| 4 | Générer une URL TOTP (`$google2fa->getQRCodeUrl(...)`) | ❌ |
| 5 | Retourner le secret + l'URL du QR code (NE PAS activer encore) | ❌ |
| 6 | Stocker le secret temporairement (chiffré) en BDD ou en session | ❌ |
| 7 | Ajouter la route dans `api.php` (auth:sanctum) | ❌ |

---

### B9 — 2FA — Vérification et activation finale
**Statut :** ❌ À FAIRE
**Endpoint :** `POST /api/auth/2fa/verify`
**Dépendance :** B8
**Complexité :** Élevée

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Créer `TwoFactorVerifyRequest` : valider `code` (6 chiffres) + `secret` | ❌ |
| 2 | Vérifier le code TOTP avec le secret (`$google2fa->verifyKey(...)`) | ❌ |
| 3 | Si valide : activer `two_factor_enabled = true` | ❌ |
| 4 | Sauvegarder le secret chiffré en BDD (`two_factor_secret`) | ❌ |
| 5 | Retourner message de succès | ❌ |
| 6 | Si invalide : retourner 422 | ❌ |

---

### B10 — 2FA — Désactivation
**Statut :** ❌ À FAIRE
**Endpoint :** `POST /api/auth/2fa/disable`
**Dépendance :** B9
**Complexité :** Moyenne

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Créer `TwoFactorDisableRequest` : valider `password` + `code` (6 chiffres) | ❌ |
| 2 | Vérifier le mot de passe actuel (`Hash::check`) | ❌ |
| 3 | Vérifier le code TOTP avec le secret stocké | ❌ |
| 4 | Désactiver `two_factor_enabled = false` | ❌ |
| 5 | Supprimer `two_factor_secret` de la BDD | ❌ |
| 6 | Logger l'événement | ❌ |
| 7 | Retourner message de succès | ❌ |

---

### B11 — 2FA — Étape de vérification au login
**Statut :** ❌ À FAIRE
**Endpoints :** `POST /api/auth/login` (modification) + `POST /api/auth/2fa/login`
**Dépendance :** B8, B9
**Complexité :** Élevée

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Modifier `AuthService::attempt()` : si `two_factor_enabled = true`, ne PAS générer le token final | ❌ |
| 2 | Générer un `temp_token` temporaire (valide 5 min) contenant l'ID utilisateur | ❌ |
| 3 | Retourner `{ temp_token: "...", two_factor_required: true }` au lieu du vrai token | ❌ |
| 4 | Créer `POST /api/auth/2fa/login` : valider `temp_token` + `code` | ❌ |
| 5 | Vérifier la validité du `temp_token` (expiry, non réutilisé) | ❌ |
| 6 | Vérifier le code TOTP avec le secret de l'utilisateur | ❌ |
| 7 | Si OK : générer le vrai token Sanctum, retourner `user` + `token` | ❌ |
| 8 | Si KO : logger l'échec, retourner 422 | ❌ |
| 9 | Blocage après 5 tentatives échouées (cooldown 15 min) | ❌ |
| 10 | Supprimer le `temp_token` après usage | ❌ |

---

### B12 — Session unique (EnsureSingleSession)
**Statut :** ✅ DONE (middleware existant, à activer dans les routes)
**Middleware :** `EnsureSingleSession.php`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | À chaque requête authentifiée, supprimer les tokens autres que le courant | ✅ |
| 2 | Enregistrer le middleware dans `bootstrap/app.php` ou `Kernel.php` | ❌ À activer |

---

### B13 — Déconnexion par inactivité (InactivityLogout)
**Statut :** ❌ À CORRIGER
**Middleware :** `InactivityLogout.php`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Remplacer `Auth::guard('web')` par `$request->user()` (Sanctum) | ❌ |
| 2 | Vérifier `last_login_at` vs `config('session.lifetime')` (en minutes) | ❌ |
| 3 | Si expiré : supprimer le token courant → retourner 401 | ❌ |
| 4 | Si actif : ne rien faire, laisser passer la requête | ❌ |
| 5 | Logger la déconnexion pour inactivité | ❌ |
| 6 | Enregistrer le middleware dans les routes API concernées | ❌ |

---

### B14 — Suppression de compte
**Statut :** ❌ À FAIRE
**Endpoint :** `DELETE /api/auth/account`
**Fichiers à créer :** `DeleteAccountRequest.php`, modification contrôleur ou nouveau
**Complexité :** Moyenne

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Créer `DeleteAccountRequest` : valider `password` (required) | ❌ |
| 2 | Vérifier le mot de passe actuel (`Hash::check`) | ❌ |
| 3 | Empêcher la suppression d'un super-admin (dernier admin) | ❌ |
| 5 | Révoquer **tous** les tokens Sanctum | ❌ |
| 6 | Logger l'événement dans `login_logs` (action: `account_deleted`) | ❌ |
| 7 | Retourner 200 avec message de confirmation | ❌ |
| 8 | Ajouter la route dans `api.php` (auth:sanctum) | ❌ |
| 9 | Ajouter les tests | ❌ |

---

### B15 — Vérification d'email (optionnel)
**Statut :** ❌ À FAIRE (à valider avec le boss)
**Endpoints :** `GET /api/auth/email/verify/{id}/{hash}` + `POST /api/auth/email/resend`
**Complexité :** Moyenne

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Ajouter `MustEmailVerification` au modèle `User` | ❌ |
| 2 | Créer la route de vérification (signed URL) | ❌ |
| 3 | Vérifier le hash et marquer `email_verified_at = now()` | ❌ |
| 4 | Créer la route de renvoi d'email | ❌ |
| 5 | Envoyer l'email de vérification | ❌ |
| 6 | Retourner 200 avec message | ❌ |

---

## FRONTEND

### F1 — Page de connexion
**Statut :** ✅ EN COURS
**Route :** `/login`
**Composants :** `Login.vue` (ou `.tsx`)

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Formulaire : champ email + champ mot de passe | ✅ |
| 2 | Bouton "Se connecter" avec loading state | ✅ |
| 3 | Lien "Mot de passe oublié ?" → /forgot-password | ❌ |
| 4 | Lien "Créer un compte" → /register | ✅ |
| 5 | Affichage des erreurs de validation (API response) | ✅ |
| 6 | Appel API `POST /api/auth/login` | ✅ |
| 7 | Stocker le token (localStorage/cookie) | ✅ |
| 8 | Redirection vers `/dashboard` après succès | ✅ |
| 9 | Gérer les erreurs : 422 (identifiants incorrects / compte désactivé) | ✅ |

---

### F2 — Page d'inscription
**Statut :** ❌ À FAIRE
**Route :** `/register`
**Composants :** `Register.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Formulaire : username, email, prénom, nom, téléphone | ❌ |
| 2 | Champ mot de passe + confirmation | ❌ |
| 3 | Validation côté client (min 8 car., match confirmation) | ❌ |
| 4 | Bouton "S'inscrire" avec loading state | ❌ |
| 5 | Appel API `POST /api/auth/register` | ❌ |
| 6 | Affichage des erreurs de validation | ❌ |
| 7 | Redirection vers `/login` après succès | ❌ |
| 8 | Lien "Déjà un compte ? Se connecter" | ❌ |
| 9 | Toast notification de succès | ❌ |

---

### F3 — Page mot de passe oublié
**Statut :** ❌ À FAIRE
**Route :** `/forgot-password`
**Composants :** `ForgotPassword.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Formulaire : champ email | ❌ |
| 2 | Bouton "Envoyer le lien" avec loading state | ❌ |
| 3 | Appel API `POST /api/auth/forgot-password` | ❌ |
| 4 | Message de confirmation (même si email inexistant) | ❌ |
| 5 | Lien retour vers `/login` | ❌ |
| 6 | Désactiver le formulaire après soumission | ❌ |

---

### F4 — Page réinitialisation de mot de passe
**Statut :** ❌ À FAIRE
**Route :** `/reset-password?token=xxx&email=xxx`
**Composants :** `ResetPassword.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Récupérer `token` et `email` depuis les query params de l'URL | ❌ |
| 2 | Formulaire : nouveau mot de passe + confirmation | ❌ |
| 3 | Champ email pré-rempli (readonly) | ❌ |
| 4 | Bouton "Réinitialiser" avec loading state | ❌ |
| 5 | Appel API `POST /api/auth/reset-password` | ❌ |
| 6 | Redirection vers `/login` après succès | ❌ |
| 7 | Message d'erreur si token expiré/invalide | ❌ |
| 8 | Toast notification | ❌ |

---

### F5 — Changement de mot de passe (dans le profil)
**Statut :** ❌ À FAIRE
**Route :** `/profile` (section dans la page profil)
**Composants :** `ChangePassword.vue` (composant intégré dans le profil)

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Formulaire : mot de passe actuel, nouveau mot de passe, confirmation | ❌ |
| 2 | Validation côté client | ❌ |
| 3 | Bouton "Mettre à jour" avec loading state | ❌ |
| 4 | Appel API `PUT /api/auth/change-password` | ❌ |
| 5 | Message de succès (toast) | ❌ |
| 6 | Réinitialiser les champs du formulaire après succès | ❌ |
| 7 | Déconnexion des autres appareils (afficher un message d'info) | ❌ |

---

### F6 — Activation de la 2FA (page profil)
**Statut :** ❌ À FAIRE
**Route :** `/profile` (section sécurité)
**Composants :** `TwoFactorEnable.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Bouton "Activer la double authentification" | ❌ |
| 2 | Appel API `POST /api/auth/2fa/enable` | ❌ |
| 3 | Afficher le QR code (image depuis l'URL retournée) | ❌ |
| 4 | Afficher le secret en texte (pour copier manuellement) | ❌ |
| 5 | Champ : saisie du code TOTP (6 chiffres) pour validation | ❌ |
| 6 | Bouton "Confirmer l'activation" | ❌ |
| 7 | Appel API `POST /api/auth/2fa/verify` | ❌ |
| 8 | Message de succès + afficher les codes de secours | ❌ |
| 9 | Afficher un message d'erreur si code invalide | ❌ |

---

### F7 — Désactivation de la 2FA (page profil)
**Statut :** ❌ À FAIRE
**Route :** `/profile` (section sécurité)
**Composants :** `TwoFactorDisable.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Bouton "Désactiver la double authentification" | ❌ |
| 2 | Modal : champ mot de passe actuel + code TOTP | ❌ |
| 3 | Appel API `POST /api/auth/2fa/disable` | ❌ |
| 4 | Message de succès | ❌ |
| 5 | Mettre à jour l'état UI (2FA marquée comme désactivée) | ❌ |

---

### F8 — Page de vérification 2FA (au login)
**Statut :** ❌ À FAIRE
**Route :** `/2fa-verify`
**Composants :** `TwoFactorVerify.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Affichée quand `two_factor_required = true` dans la réponse de login | ❌ |
| 2 | Champ : code TOTP (6 chiffres, input mask) | ❌ |
| 3 | Bouton "Vérifier" avec loading state | ❌ |
| 4 | Appel API `POST /api/auth/2fa/login` avec `temp_token` + `code` | ❌ |
| 5 | Redirection vers `/dashboard` après succès | ❌ |
| 6 | Lien "Utiliser un code de secours" (optionnel) | ❌ |
| 7 | Timer de session (afficher le temps restant du `temp_token`) | ❌ |
| 8 | Message d'erreur si code invalide | ❌ |
| 9 | Retourner vers `/login` si `temp_token` expiré | ❌ |

---

### F9 — Header / Menu utilisateur
**Statut :** ❌ À FAIRE
**Composants :** `UserMenu.vue`, `Header.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Afficher le nom complet de l'utilisateur connecté | ❌ |
| 2 | Afficher le rôle (badge) | ❌ |
| 3 | Bouton dropdown : "Mon profil", "Déconnexion" | ❌ |
| 4 | Indicateur visuel si 2FA activée (icône bouclier ✅) | ❌ |
| 5 | Indicateur si 2FA non activée (icône ⚠️ + lien vers profil) | ❌ |
| 6 | Appel API `POST /api/auth/logout` au clic sur "Déconnexion" | ❌ |
| 7 | Supprimer le token du stockage + redirection vers `/login` | ❌ |

---

### F10 — Suppression de compte (page profil)
**Statut :** ❌ À FAIRE
**Route :** `/profile` (section "Zone de danger")
**Composants :** `DeleteAccount.vue`

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Section "Zone de danger" avec style rouge/avertissement | ❌ |
| 2 | Bouton "Supprimer mon compte" | ❌ |
| 3 | Modal de confirmation : avertissement "Cette action est irréversible" | ❌ |
| 4 | Champ : saisie du mot de passe pour confirmer | ❌ |
| 5 | Bouton "Confirmer la suppression" (désactivé tant que pas de mot de passe) | ❌ |
| 6 | Appel API `DELETE /api/auth/account` | ❌ |
| 7 | Redirection vers `/login` après succès | ❌ |
| 8 | Toast notification de confirmation | ❌ |

---

### F11 — Gestion des erreurs d'authentification
**Statut :** ❌ À FAIRE
**Composants :** Intercepteur API (axios/fetch interceptor)

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Intercepteur 401 → supprimer le token + redirection vers `/login` | ❌ |
| 2 | Intercepteur 403 → page ou toast "Accès interdit" | ❌ |
| 3 | Toast notifications pour succès/erreur (système global) | ❌ |
| 4 | Gestion du token expiré (auto-logout silencieux) | ❌ |
| 5 | Message "Votre session a expiré, veuillez vous reconnecter" | ❌ |

---

### F12 — Route protection (guards)
**Statut :** ❌ À FAIRE
**Middleware JS :** `auth.js` (guard route)

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Guard vérifiant la présence du token dans le store/localStorage | ❌ |
| 2 | Redirection vers `/login` si non authentifié et route protégée | ❌ |
| 3 | Redirection vers `/dashboard` si déjà connecté et route publique (`/login`, `/register`) | ❌ |
| 4 | Application du guard dans le routeur Vue/React | ❌ |
| 5 | Gestion du chargement initial (vérifier le token au démarrage de l'app) | ❌ |

---

## Résumé

| Catégorie | DONE | À FAIRE | Total |
|-----------|------|---------|-------|
| Backend | 4 | 11 | 15 |
| Frontend | 1 | 11 | 12 |
| **Total** | **5** | **22** | **27** |

### Priorités recommandées

| Priorité | Tâches |
|----------|--------|
| 🔴 Haute | B5, B6, B7 (gestion mots de passe), F11, F12 (erreurs & guards) |
| 🟠 Moyenne | B14 (suppression compte), F2, F5, F9, F10 |
| 🟡 Basse | B8-B11 (2FA), F3, F4, F6, F7, F8 |
| ⚪ Optionnel | B13 (inactivité), B15 (vérification email) |
