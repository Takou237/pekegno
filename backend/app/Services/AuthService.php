<?php

namespace App\Services;

use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function attempt(array $credentials, string $ip = null, string $userAgent = null): array
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

        $token = $user->createToken('auth-token')->plainTextToken;

        $this->log(
            user: $user,
            action: 'login',
            ip: $ip,
            userAgent: $userAgent,
        );

        $user->update([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
        ]);

        return [
            'user' => $user->load('role'),
            'token' => $token,
        ];
    }

    public function logout(User $user, string $ip = null, string $userAgent = null): void
    {
        $user->currentAccessToken()->delete();

        $this->log(
            user: $user,
            action: 'logout',
            ip: $ip,
            userAgent: $userAgent,
        );
    }

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

        $this->log(
            user: $user,
            action: 'register',
            ip: $ip,
            userAgent: $userAgent,
        );

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    private function log(?User $user, string $action, string $ip = null, string $userAgent = null, string $reason = null, string $email = null): void
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
