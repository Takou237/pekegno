# 📋 Taches Réalisées — Module Authentification Backend

> **Dernière mise à jour :** 2026-07-23
> **Statut :** 14/15 tâches backend terminées

---

## Table des matières

1. [B1 — Connexion (Login)](#b1--connexion-login)
2. [B2 — Inscription (Register)](#b2--inscription-register)
3. [B3 — Déconnexion (Logout)](#b3--déconnexion-logout)
4. [B4 — Profil utilisateur](#b4--profil-utilisateur)
5. [B5 — Mot de passe oublié](#b5--mot-de-passe-oublié)
6. [B6 — Réinitialisation mot de passe](#b6--réinitialisation-mot-de-passe)
7. [B7 — Changement mot de passe](#b7--changement-mot-de-passe)
8. [B8-B11 — Authentification à deux facteurs](#b8-b11--authentification-deux-facteurs)
9. [B12 — Session unique](#b12--session-unique)
10. [B13 — Déconnexion par inactivité](#b13--déconnexion-par-inactivité)
11. [B14 — Suppression de compte](#b14--suppression-de-compte)

---

## B1 — Connexion (Login)

### `app/Http/Controllers/Api/Auth/LoginController.php`

**Rôle :** Point d'entrée API pour la connexion utilisateur.

```php
// Injection du service d'authentification
public function __construct(
    private readonly AuthService $authService
) {}

// Invokable controller - appelé directement via POST /api/auth/login
public function __invoke(LoginRequest $request): JsonResponse
{
    $result = $this->authService->attempt(
        credentials: $request->validated(),
        ip: $request->ip(),
        userAgent: $request->userAgent(),
    );

    return response()->json($result);
}
```

**Points clés :**
- Utilise `LoginRequest` pour la validation automatique
- Délègue toute la logique métier à `AuthService`
- Annotations OpenAPI (`#[OA\Post]`) pour Swagger

---

### `app/Http/Requests/Api/LoginRequest.php`

**Rôle :** Validation des données d'entrée pour la connexion.

```php
public function rules(): array
{
    return [
        'email' => ['required', 'email'],
        'password' => ['required', 'string'],
    ];
}
```

---

### `app/Services/AuthService.php`

**Rôle :** Service central contenant toute la logique métier d'authentification.

**Méthode `attempt()` — Logique de connexion :**

```php
public function attempt(array $credentials, string $ip = null, string $userAgent = null): array
{
    // 1. Recherche de l'utilisateur par email
    $user = User::with('role')->where('email', $credentials['email'])->first();

    // 2. Vérification du mot de passe
    if (! $user || ! Hash::check($credentials['password'], $user->password)) {
        $this->log(user: null, action: 'failed_login', ...);
        throw ValidationException::withMessages([...]);
    }

    // 3. Vérification du statut du compte
    if (! $user->is_active) {
        $this->log(user: $user, action: 'failed_login', ...);
        throw ValidationException::withMessages([...]);
    }

    // 4. Gestion de la 2FA
    if ($user->two_factor_enabled && $user->two_factor_secret) {
        $tempToken = Str::random(64);
        cache()->put('2fa_temp_token:' . $tempToken, [...], 300); // 5 min
        return ['temp_token' => $tempToken, 'two_factor_required' => true];
    }

    // 5. Génération du token Sanctum
    $token = $user->createToken('auth-token')->plainTextToken;

    // 6. Mise à jour des infos de connexion
    $user->update(['last_login_at' => now(), 'last_login_ip' => $ip]);

    // 7. Logging
    $this->log(user: $user, action: 'login', ...);

    return ['user' => $user->load('role'), 'token' => $token];
}
```

---

## B2 — Inscription (Register)

### `app/Http/Controllers/Api/Auth/RegisterController.php`

**Rôle :** Point d'entry API pour l'inscription.

```php
public function __invoke(RegisterRequest $request): JsonResponse
{
    $result = $this->authService->register(
        data: $request->validated(),
        ip: $request->ip(),
        userAgent: $request->userAgent(),
    );

    return response()->json($result, 201); // Code 201 Created
}
```

---

### `app/Http/Requests/Api/RegisterRequest.php`

**Rôle :** Validation des données d'inscription.

```php
public function rules(): array
{
    return [
        'username' => ['required', 'string', 'max:100', 'unique:users,username'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
        'first_name' => ['sometimes', 'nullable', 'string', 'max:150'],
        'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
        'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
    ];
}
```

**Points clés :**
- `unique:users,username` et `unique:users,email` pour l'unicité
- `confirmed` exige que `password_confirmation` corresponde
- Champs optionnels avec `sometimes`

---

### `app/Services/AuthService.php` — Méthode `register()`

```php
public function register(array $data, string $ip = null, string $userAgent = null): array
{
    $user = User::create([
        'username' => $data['username'],
        'email' => $data['email'],
        'password' => Hash::make($data['password']),
        'first_name' => $data['first_name'] ?? null,
        'last_name' => $data['last_name'] ?? null,
        'phone' => $data['phone'] ?? null,
    ]);

    $token = $user->createToken('auth-token')->plainTextToken;

    $this->log(user: $user, action: 'register', ...);

    return ['user' => $user, 'token' => $token];
}
```

---

## B3 — Déconnexion (Logout)

### `app/Http/Controllers/Api/Auth/LogoutController.php`

**Rôle :** Déconnexion de l'utilisateur courant.

```php
public function __invoke(Request $request): JsonResponse
{
    $this->authService->logout(
        user: $request->user(),
        ip: $request->ip(),
        userAgent: $request->userAgent(),
    );

    return response()->json(['message' => 'Déconnexion réussie.']);
}
```

---

### `app/Services/AuthService.php` — Méthode `logout()`

```php
public function logout(User $user, string $ip = null, string $userAgent = null): void
{
    // Supprime le token Sanctum courant
    $user->currentAccessToken()->delete();

    // Logger la déconnexion
    $this->log(user: $user, action: 'logout', ...);
}
```

---

## B4 — Profil utilisateur

### `app/Http/Controllers/Api/ProfileController.php`

**Rôle :** Retourne les données de l'utilisateur connecté.

```php
public function __invoke(Request $request): JsonResponse
{
    return response()->json($request->user());
}
```

**Points clés :**
- Le modèle `User` a `protected $with = ['role']` → le rôle est eager-loaded automatiquement
- Middleware `auth:sanctum` protège l'endpoint

---

## B5 — Mot de passe oublié

### `app/Http/Controllers/Api/Auth/ForgotPasswordController.php`

**Rôle :** Génère un token de réinitialisation et envoie un email.

```php
public function __invoke(ForgotPasswordRequest $request): JsonResponse
{
    $email = $request->validated('email');

    // 1. Supprime les anciens tokens pour cet email
    DB::table('password_reset_tokens')->where('email', $email)->delete();

    // 2. Génère un token aléatoire
    $token = Str::random(64);

    // 3. Stocke le hash du token en BDD
    DB::table('password_reset_tokens')->insert([
        'email' => $email,
        'token' => hash('sha256', $token),
        'created_at' => now(),
    ]);

    // 4. Construit l'URL de réinitialisation
    $resetUrl = config('app.frontend_url', 'http://localhost:5173')
        . "/reset-password?token={$token}&email={$email}";

    // 5. Envoie l'email
    Mail::to($email)->send(new ResetPasswordMail($resetUrl));

    // 6. Message générique (pas d'énumération d'emails)
    return response()->json([
        'message' => 'Si un compte est associé à cette adresse email, vous recevrez un lien de réinitialisation.',
    ]);
}
```

**Points clés :**
- Token stocké en SHA256 (jamais en clair)
- Message générique pour éviter l'énumération d'emails
- URL de redirection vers le frontend

---

### `app/Http/Requests/Api/ForgotPasswordRequest.php`

```php
public function rules(): array
{
    return [
        'email' => ['required', 'email'],
    ];
}
```

---

### `app/Mail/ResetPasswordMail.php`

**Rôle :** Mailable pour l'email de réinitialisation.

```php
class ResetPasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $url, // URL de réinitialisation
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Réinitialisation de votre mot de passe PEKEGNO',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reset-password', // Vue Blade
        );
    }
}
```

---

## B6 — Réinitialisation mot de passe

### `app/Http/Controllers/Api/Auth/ResetPasswordController.php`

**Rôle :** Réinitialise le mot de passe avec un token valide.

```php
public function __invoke(ResetPasswordRequest $request): JsonResponse
{
    $token = $request->validated('token');
    $email = $request->validated('email');

    // 1. Vérifie la validité du token (hash SHA256)
    $resetToken = DB::table('password_reset_tokens')
        ->where('email', $email)
        ->where('token', hash('sha256', $token))
        ->first();

    if (! $resetToken) {
        return response()->json(['message' => 'Ce token de réinitialisation est invalide.'], 422);
    }

    // 2. Vérifie l'expiration (60 minutes)
    if (Carbon::parse($resetToken->created_at)->diffInMinutes(now()) > 60) {
        DB::table('password_reset_tokens')->where('email', $email)->delete();
        return response()->json(['message' => 'Ce token de réinitialisation a expiré.'], 422);
    }

    // 3. Met à jour le mot de passe
    $user = User::where('email', $email)->first();
    $user->update(['password' => Hash::make($request->validated('password'))]);

    // 4. Révoque TOUS les tokens Sanctum (reconnexion forcée)
    $user->tokens()->delete();

    // 5. Supprime le token utilisé
    DB::table('password_reset_tokens')->where('email', $email)->delete();

    return response()->json(['message' => 'Votre mot de passe a été réinitialisé avec succès.']);
}
```

---

### `app/Http/Requests/Api/ResetPasswordRequest.php`

```php
public function rules(): array
{
    return [
        'token' => ['required', 'string'],
        'email' => ['required', 'email', 'exists:users,email'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
    ];
}
```

---

## B7 — Changement mot de passe

### `app/Http/Controllers/Api/Auth/ChangePasswordController.php`

**Rôle :** Change le mot de passe d'un utilisateur connecté.

```php
public function __invoke(ChangePasswordRequest $request): JsonResponse
{
    $user = $request->user();

    // 1. Vérifie le mot de passe actuel
    if (! Hash::check($request->validated('current_password'), $user->password)) {
        return response()->json(['message' => 'Le mot de passe actuel est incorrect.'], 422);
    }

    // 2. Met à jour le mot de passe
    $user->update(['password' => Hash::make($request->validated('password'))]);

    // 3. Révoque les autres tokens (sauf le courant)
    $currentToken = $user->currentAccessToken();
    $user->tokens()->where('id', '!=', $currentToken->id)->delete();

    return response()->json([
        'message' => 'Votre mot de passe a été changé avec succès. Les autres sessions ont été déconnectées.',
    ]);
}
```

---

### `app/Http/Requests/Api/ChangePasswordRequest.php`

```php
public function rules(): array
{
    return [
        'current_password' => ['required', 'string'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
    ];
}
```

---

## B8-B11 — Authentification à deux facteurs

### `app/Services/TwoFactorService.php`

**Rôle :** Service custom implémentant TOTP (sans dépendance externe).

```php
class TwoFactorService
{
    private const SECRET_LENGTH = 20;
    private const TOTP_PERIOD = 30; // secondes
    private const TOTP_DIGITS = 6;
    private const TOTP_WINDOW = 1; // tolérance ±1 période

    // Génère un secret Base32
    public function generateSecretKey(): string { ... }

    // Génère l'URL pour le QR code
    public function getQRCodeUrl(string $email, string $secret, string $issuer = 'PEKEGNO'): string
    {
        return 'otpauth://totp/' . rawurlencode($issuer) . ':' . rawurlencode($email) . '?' . $params;
    }

    // Vérifie un code TOTP
    public function verifyKey(string $secret, string $key): bool { ... }

    // Génère un code TOTP pour un temps donné
    private function generateTotp(string $secret, int $time): string { ... }

    // Décode Base32
    private function base32Decode(string $input): string { ... }
}
```

---

### `app/Http/Controllers/Api/Auth/TwoFactorController.php`

**Rôle :** Contrôleur gérant les 4 actions 2FA.

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `enable()` | `POST /api/auth/2fa/enable` | Génère le secret et l'URL QR |
| `verify()` | `POST /api/auth/2fa/verify` | Active la 2FA après vérification du code |
| `disable()` | `POST /api/auth/2fa/disable` | Désactive la 2FA |
| `login()` | `POST /api/auth/2fa/login` | Vérifie le code lors du login |

**Flux d'activation :**
1. `enable()` → stocke le secret chiffré (`Crypt::encrypt`) en BDD
2. `verify()` → vérifie le code, puis active `two_factor_enabled = true`

**Flux de connexion 2FA :**
1. `AuthService::attempt()` détecte `two_factor_enabled = true`
2. Retourne `temp_token` (valide 5 min via Cache) au lieu du vrai token
3. `TwoFactorController::login()` vérifie le code et retourne le vrai token

---

### `app/Http/Requests/Api/TwoFactorVerifyRequest.php`

```php
public function rules(): array
{
    return ['code' => ['required', 'string', 'size:6']];
}
```

### `app/Http/Requests/Api/TwoFactorDisableRequest.php`

```php
public function rules(): array
{
    return [
        'password' => ['required', 'string'],
        'code' => ['required', 'string', 'size:6'],
    ];
}
```

### `app/Http/Requests/Api/TwoFactorLoginRequest.php`

```php
public function rules(): array
{
    return [
        'temp_token' => ['required', 'string'],
        'code' => ['required', 'string', 'size:6'],
    ];
}
```

---

### `database/migrations/2026_07_16_000001_add_two_factor_secret_to_users_table.php`

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->text('two_factor_secret')->nullable()->after('two_factor_enabled');
    });
}
```

---

## B12 — Session unique

### `app/Http/Middleware/EnsureSingleSession.php`

**Rôle :** Supprime les autres tokens Sanctum à chaque requête.

```php
public function handle(Request $request, Closure $next): Response
{
    $user = Auth::user();

    if ($user && $user->active_session_id) {
        $user->tokens()
            ->where('id', '!=', $user->currentAccessToken()?->id)
            ->delete();
    }

    return $next($request);
}
```

### `bootstrap/app.php` — Enregistrement

```php
$middleware->api(prepend: [
    EnsureSingleSession::class,
]);
```

**Points clés :**
- Middleware appliqué à TOUTES les routes API
- Supprime tous les tokens sauf celui en cours d'utilisation

---

## B13 — Déconnexion par inactivité

### `app/Http/Middleware/InactivityLogout.php`

**Rôle :** Déconnecte l'utilisateur après une période d'inactivité.

```php
public function handle(Request $request, Closure $next): Response
{
    $user = $request->user();

    if ($user && $user->last_login_at) {
        $sessionLifetime = config('session.lifetime', 120); // minutes
        $inactiveMinutes = now()->diffInMinutes($user->last_login_at);

        if ($inactiveMinutes >= $sessionLifetime) {
            $user->currentAccessToken()?->delete();

            return response()->json([
                'message' => 'Session expirée pour inactivité.',
            ], 401);
        }
    }

    return $next($request);
}
```

### `bootstrap/app.php` — Enregistrement comme alias

```php
$middleware->alias([
    'inactivity.logout' => InactivityLogout::class,
]);
```

**Note :** Le middleware est enregistré comme alias mais pas encore appliqué aux routes. À activer si nécessaire.

---

## B14 — Suppression de compte

### `app/Http/Controllers/Api/Auth/DeleteAccountController.php`

**Rôle :** Supprime le compte de l'utilisateur connecté.

```php
public function __invoke(DeleteAccountRequest $request): JsonResponse
{
    $user = $request->user();

    // 1. Vérifie le mot de passe
    if (! Hash::check($request->validated('password'), $user->password)) {
        return response()->json(['message' => 'Le mot de passe est incorrect.'], 422);
    }

    // 2. Vérifie si c'est le dernier super-admin
    $superAdminRole = Role::where('name', 'super-admin')->first();

    if ($superAdminRole) {
        $superAdminCount = DB::table('model_has_roles')
            ->where('role_id', $superAdminRole->id)
            ->count();

        if ($superAdminCount <= 1 && $user->role_id === $superAdminRole->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer le compte du dernier super-administrateur.',
            ], 422);
        }
    }

    // 3. Log l'événement
    LoginLog::create([
        'user_id' => $user->id,
        'action' => 'account_deleted',
        'ip_address' => $request->ip(),
        'user_agent' => $request->userAgent(),
    ]);

    // 4. Révoque tous les tokens
    $user->tokens()->delete();

    // 5. Supprime l'utilisateur
    $user->delete();

    return response()->json(['message' => 'Votre compte a été supprimé avec succès.']);
}
```

**Points clés :**
- Protection contre la suppression du dernier super-admin
- Logging de l'événement dans `login_logs`
- Révocation de tous les tokens avant suppression

---

### `app/Http/Requests/Api/DeleteAccountRequest.php`

```php
public function rules(): array
{
    return ['password' => ['required', 'string']];
}
```

---

## Configuration des Routes

### `routes/api.php`

```php
// Routes publiques (pas d'authentification)
Route::post('/auth/login', LoginController::class);
Route::post('/auth/register', RegisterController::class);
Route::post('/auth/forgot-password', ForgotPasswordController::class);
Route::post('/auth/reset-password', ResetPasswordController::class);
Route::post('/auth/2fa/login', [TwoFactorController::class, 'login']);

// Routes protégées (auth:sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', LogoutController::class);
    Route::put('/auth/change-password', ChangePasswordController::class);
    Route::delete('/auth/account', DeleteAccountController::class);
    Route::get('/user', ProfileController::class);

    Route::post('/auth/2fa/enable', [TwoFactorController::class, 'enable']);
    Route::post('/auth/2fa/verify', [TwoFactorController::class, 'verify']);
    Route::post('/auth/2fa/disable', [TwoFactorController::class, 'disable']);
    // ... autres routes
});
```

---

## Configuration du Middleware

### `bootstrap/app.php`

```php
->withMiddleware(function (Middleware $middleware): void {
    // Middleware global pour toutes les routes API
    $middleware->api(prepend: [
        EnsureSingleSession::class,
    ]);

    // Alias pour utilisation sélective
    $middleware->alias([
        'inactivity.logout' => InactivityLogout::class,
    ]);
})
```

---

## Résumé des fichiers

| Fichier | Tâche | Rôle |
|---------|-------|------|
| `LoginController.php` | B1 | Endpoint de connexion |
| `LoginRequest.php` | B1 | Validation des données de login |
| `AuthService.php` | B1-B3 | Service central d'authentification |
| `RegisterController.php` | B2 | Endpoint d'inscription |
| `RegisterRequest.php` | B2 | Validation des données d'inscription |
| `LogoutController.php` | B3 | Endpoint de déconnexion |
| `ProfileController.php` | B4 | Endpoint profil utilisateur |
| `ForgotPasswordController.php` | B5 | Génération token reset |
| `ForgotPasswordRequest.php` | B5 | Validation email |
| `ResetPasswordMail.php` | B5 | Email de réinitialisation |
| `ResetPasswordController.php` | B6 | Réinitialisation mot de passe |
| `ResetPasswordRequest.php` | B6 | Validation token/email/password |
| `ChangePasswordController.php` | B7 | Changement mot de passe |
| `ChangePasswordRequest.php` | B7 | Validation passwords |
| `TwoFactorController.php` | B8-B11 | Contrôleur 2FA complet |
| `TwoFactorService.php` | B8-B11 | Service TOTP custom |
| `TwoFactorVerifyRequest.php` | B9 | Validation code 2FA |
| `TwoFactorDisableRequest.php` | B10 | Validation disable 2FA |
| `TwoFactorLoginRequest.php` | B11 | Validation login 2FA |
| `EnsureSingleSession.php` | B12 | Middleware session unique |
| `InactivityLogout.php` | B13 | Middleware inactivité |
| `DeleteAccountController.php` | B14 | Suppression de compte |
| `DeleteAccountRequest.php` | B14 | Validation password |
| `api.php` | Toutes | Configuration des routes |
| `bootstrap/app.php` | B12-B13 | Configuration middleware |
| `migration_2fa.php` | B8 | Ajout colonne 2FA |
