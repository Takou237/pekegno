<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public const MAX_FAILED_ATTEMPTS = 5;

    public const LOCK_DURATION_MINUTES = 15;

    /**
     * Connexion héritée (portail quelconque, token historique).
     */
    public function attempt(array $credentials, ?string $ip = null, ?string $userAgent = null): array
    {
        return $this->attemptForPortal($credentials, 'any', $ip, $userAgent);
    }

    /**
     * Connexion restreinte à un portail : 'staff' (employés) ou 'client'.
     */
    public function attemptForPortal(array $credentials, string $portal, ?string $ip = null, ?string $userAgent = null): array
    {
        $tokenName = $portal === 'client' ? 'client-token' : 'staff-token';

        $user = User::with('role')->where('email', $credentials['email'])->first();

        if ($user && $user->locked_until && $user->locked_until->isFuture()) {
            $this->log(
                user: $user,
                action: 'login_locked',
                ip: $ip,
                userAgent: $userAgent,
                reason: 'Account locked',
            );

            throw ValidationException::withMessages([
                'email' => ['Ce compte est temporairement bloqué. Réessayez dans quelques minutes.'],
            ]);
        }

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            $this->registerFailure($user, $credentials, $ip, $userAgent);

            throw ValidationException::withMessages([
                'email' => ['Les identifiants fournis sont incorrects.'],
            ]);
        }

        if (! $user->is_active) {
            $this->log(
                user: $user,
                action: 'failed_login',
                ip: $ip,
                userAgent: $userAgent,
                reason: 'Account disabled',
            );

            throw ValidationException::withMessages([
                'email' => ['Ce compte est désactivé.'],
            ]);
        }

        if ($portal !== 'any') {
            $isClient = $user->role?->name === 'client';
            $matchesPortal = $portal === 'client' ? $isClient : ! $isClient;

            if (! $matchesPortal) {
                $this->log(
                    user: $user,
                    action: 'failed_login',
                    ip: $ip,
                    userAgent: $userAgent,
                    reason: "Wrong portal ({$user->role?->name})",
                );

                throw ValidationException::withMessages([
                    'email' => [
                        $portal === 'client'
                            ? 'Ce compte n\'est pas un compte client.'
                            : 'Ce compte n\'est pas un compte employé.',
                    ],
                ]);
            }
        }

        if ($user->two_factor_enabled && $user->two_factor_secret) {
            $tempToken = Str::random(64);

            cache()->put(
                '2fa_temp_token:'.$tempToken,
                [
                    'user_id' => $user->id,
                    'attempts' => 0,
                ],
                300
            );

            $this->log(
                user: $user,
                action: '2fa_required',
                ip: $ip,
                userAgent: $userAgent,
            );

            return [
                'temp_token' => $tempToken,
                'two_factor_required' => true,
            ];
        }

        $accessToken = $user->createToken($tokenName);
        $token = $accessToken->plainTextToken;

        $this->log(
            user: $user,
            action: 'login',
            ip: $ip,
            userAgent: $userAgent,
        );

        $user->update([
            'active_session_id' => $accessToken->accessToken->id,
            'last_login_at' => now(),
            'last_login_ip' => $ip,
            'last_activity_at' => now(),
            'failed_attempts' => 0,
            'locked_until' => null,
        ]);

        return [
            'user' => $user->load('role', 'assignments'),
            'token' => $token,
        ];
    }

    public function logout(User $user, ?string $ip = null, ?string $userAgent = null): void
    {
        $user->currentAccessToken()->delete();

        $this->log(
            user: $user,
            action: 'logout',
            ip: $ip,
            userAgent: $userAgent,
        );
    }

    private function registerFailure(?User $user, array $credentials, ?string $ip = null, ?string $userAgent = null): void
    {
        if (! $user) {
            $this->log(
                user: null,
                action: 'failed_login',
                ip: $ip,
                userAgent: $userAgent,
                reason: 'Invalid credentials',
                email: $credentials['email'],
            );

            return;
        }

        $attempts = $user->failed_attempts + 1;

        if ($attempts >= self::MAX_FAILED_ATTEMPTS) {
            $user->update([
                'failed_attempts' => 0,
                'locked_until' => now()->addMinutes(self::LOCK_DURATION_MINUTES),
            ]);

            $this->log(
                user: $user,
                action: 'account_locked',
                ip: $ip,
                userAgent: $userAgent,
                reason: 'Too many failed attempts',
            );

            return;
        }

        $user->update(['failed_attempts' => $attempts]);

        $this->log(
            user: null,
            action: 'failed_login',
            ip: $ip,
            userAgent: $userAgent,
            reason: 'Invalid credentials',
            email: $credentials['email'],
        );
    }

    private function log(?User $user, string $action, ?string $ip = null, ?string $userAgent = null, ?string $reason = null, ?string $email = null): void
    {
        LoginLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'failure_reason' => $reason,
        ]);

        // Reflet dans activity_logs pour connexions/déconnexions réussies (plan §4.4)
        if ($user !== null && in_array($action, ['login', 'logout'], true)) {
            ActivityLog::create([
                'user_id' => $user->id,
                'agency_id' => $user->primaryAgency()->value('agencies.id'),
                'action' => $action,
                'entity_type' => 'auth',
                'entity_id' => $user->id,
                'description' => $action === 'login' ? "Connexion de {$user->email}" : "Déconnexion de {$user->email}",
                'ip_address' => $ip,
                'user_agent' => $userAgent,
            ]);
        }
    }
}