<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Centre de sécurité du super-admin (Lot 9) : sessions actives, comptes
 * privilégiés, accès développeurs et derniers événements de sécurité.
 */
class SecurityCenterController extends Controller
{
    private const PRIVILEGED_ROLES = [
        'super-admin',
        'direction-generale',
        'comptable',
        'caissier',
        'responsable-agence',
        'responsable-departement',
    ];

    public function __invoke(Request $request): JsonResponse
    {
        if ($request->user()?->role?->name !== 'super-admin') {
            abort(403, 'Accès réservé au super-admin.');
        }

        $sessions = DB::table('personal_access_tokens')
            ->join('users', 'users.id', '=', 'personal_access_tokens.tokenable_id')
            ->leftJoin('roles', 'roles.id', '=', 'users.role_id')
            ->where('users.is_active', true)
            ->orderByDesc('personal_access_tokens.last_used_at')
            ->limit(50)
            ->get([
                'personal_access_tokens.id',
                'personal_access_tokens.name',
                'personal_access_tokens.created_at',
                'personal_access_tokens.last_used_at',
                'users.id as user_id',
                'users.first_name',
                'users.last_name',
                'users.email',
                'roles.name as role',
            ])
            ->map(fn ($row) => [
                'id' => $row->id,
                'token_name' => $row->name,
                'user' => [
                    'id' => $row->user_id,
                    'name' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')),
                    'email' => $row->email,
                    'role' => $row->role,
                ],
                'created_at' => $row->created_at,
                'last_used_at' => $row->last_used_at,
            ]);

        $privileged = User::query()
            ->with('role:id,name')
            ->whereHas('role', fn ($q) => $q->whereIn('name', self::PRIVILEGED_ROLES))
            ->orderBy('last_name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => trim(($user->first_name ?? '').' '.($user->last_name ?? '')),
                'email' => $user->email,
                'role' => $user->role?->name,
                'is_active' => (bool) $user->is_active,
                'two_factor_enabled' => (bool) $user->two_factor_enabled,
                'two_factor_channel' => $user->two_factor_channel,
                'last_login_at' => $user->last_login_at,
                'last_login_ip' => $user->last_login_ip,
            ]);

        $developers = collect(config('security.developer_emails', []))
            ->map(fn (string $email) => [
                'email' => $email,
                'user' => $privileged->firstWhere('email', $email),
            ])
            ->values();

        $events = ActivityLog::query()
            ->with('user:id,first_name,last_name,email')
            ->orderByDesc('created_at')
            ->limit(25)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'user' => $log->user ? [
                    'id' => $log->user->id,
                    'name' => trim(($log->user->first_name ?? '').' '.($log->user->last_name ?? '')),
                    'email' => $log->user->email,
                ] : null,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at,
            ]);

        return response()->json([
            'environment' => [
                'app_env' => app()->environment(),
                'debug' => (bool) config('app.debug'),
                'staging' => app()->environment() !== 'production',
            ],
            'sessions' => $sessions,
            'privileged_accounts' => $privileged,
            'developer_access' => $developers,
            'recent_events' => $events,
            'alerts' => $this->alerts($privileged),
        ]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $privileged
     * @return string[]
     */
    private function alerts($privileged): array
    {
        $alerts = [];

        $withoutTwoFactor = $privileged
            ->filter(fn (array $user) => $user['is_active'] && ! $user['two_factor_enabled'])
            ->pluck('email')
            ->all();

        if ($withoutTwoFactor !== []) {
            $alerts[] = 'Comptes privilégiés sans double authentification : '.implode(', ', $withoutTwoFactor);
        }

        if (app()->environment() === 'production' && config('app.debug')) {
            $alerts[] = 'Le mode debug est actif en production.';
        }

        return $alerts;
    }
}
