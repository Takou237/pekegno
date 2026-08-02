<?php

namespace App\Services;

use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function attempt(array $credentials, ?string $ip = null, ?string $userAgent = null): array
    {
        $user = User::with('role')->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            $this->log(
                user: null,
                action: 'failed_login',
                ip: $ip,
                userAgent: $userAgent,
                reason: 'Invalid credentials',
                email: $credentials['email'],
            );

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

        $accessToken = $user->createToken('auth-token');
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

    private function log(?User $user, string $action, ?string $ip = null, ?string $userAgent = null, ?string $reason = null, ?string $email = null): void
    {
        LoginLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'failure_reason' => $reason,
        ]);
    }
}
