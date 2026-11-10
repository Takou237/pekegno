<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Lot 9 : audit des comptes nominatifs. Repère les comptes génériques ou
 * partagés (admin, caissier provisoire, test…) et peut les désactiver.
 */
class SecurityAuditAccounts extends Command
{
    protected $signature = 'security:audit-accounts
                            {--fix : Désactiver les comptes génériques (hors super-admin)}
                            {--json : Sortir le rapport en JSON}';

    protected $description = 'Audite les comptes génériques/partagés et propose leur désactivation';

    /** Fragments de nom ou d'email qui trahissent un compte non nominatif. */
    private const GENERIC_PATTERNS = [
        'admin',
        'administrateur',
        'root',
        'test',
        'demo',
        'provisoire',
        'support',
        'caissier',
        'comptable',
        'direction',
        'manager',
    ];

    public function handle(): int
    {
        $staff = User::query()
            ->with('role')
            ->whereHas('role', fn ($q) => $q->where('name', '!=', 'client'))
            ->orderBy('created_at')
            ->get();

        $findings = $staff
            ->map(fn (User $user) => [
                'user' => $user,
                'reasons' => $this->reasons($user),
            ])
            ->filter(fn (array $finding) => $finding['reasons'] !== [])
            ->values();

        $duplicates = $this->duplicateNames($staff);

        $report = $findings->map(fn (array $finding) => [
            'id' => $finding['user']->id,
            'name' => trim(($finding['user']->first_name ?? '').' '.($finding['user']->last_name ?? '')),
            'email' => $finding['user']->email,
            'role' => $finding['user']->role?->name,
            'active' => (bool) $finding['user']->is_active,
            'reasons' => $finding['reasons'],
        ])->all();

        $fixed = [];
        if ($this->option('fix')) {
            foreach ($findings as $finding) {
                $user = $finding['user'];

                if ($user->role?->name === 'super-admin') {
                    continue;
                }

                $user->update(['is_active' => false]);
                $fixed[] = $user->email;
            }
        }

        if ($this->option('json')) {
            $this->line(json_encode([
                'findings' => $report,
                'duplicate_names' => $duplicates,
                'deactivated' => $fixed,
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

            return $report === [] ? self::SUCCESS : self::FAILURE;
        }

        if ($report === [] && $duplicates === []) {
            $this->info('Aucun compte générique ou partagé détecté.');

            return self::SUCCESS;
        }

        $this->warn(count($report).' compte(s) générique(s) détecté(s).');
        $this->table(
            ['Nom', 'Email', 'Rôle', 'Actif', 'Motifs'],
            array_map(fn (array $row) => [
                $row['name'],
                $row['email'],
                $row['role'],
                $row['active'] ? 'oui' : 'non',
                implode(', ', $row['reasons']),
            ], $report),
        );

        if ($duplicates !== []) {
            $this->warn('Noms identiques parmi le personnel :');
            foreach ($duplicates as $name => $emails) {
                $this->line(" - {$name} : ".implode(', ', $emails));
            }
        }

        if ($fixed !== []) {
            $this->info(count($fixed).' compte(s) désactivé(s) : '.implode(', ', $fixed));
        } elseif ($report !== []) {
            $this->line('Relancer avec --fix pour désactiver les comptes génériques (le super-admin est conservé).');
        }

        return self::FAILURE;
    }

    /**
     * @return string[]
     */
    private function reasons(User $user): array
    {
        $reasons = [];
        $email = mb_strtolower((string) $user->email);
        $localPart = strstr($email, '@', true) ?: $email;
        $fullName = mb_strtolower(trim(($user->first_name ?? '').' '.($user->last_name ?? '')));

        foreach (self::GENERIC_PATTERNS as $pattern) {
            if (str_contains($localPart, $pattern) || str_contains($fullName, $pattern)) {
                $reasons[] = "compte générique « {$pattern} »";
                break;
            }
        }

        if (str_contains($email, '@sans-email.pekegno.local')) {
            $reasons[] = 'aucune adresse email personnelle';
        }

        if ($user->role?->name === 'super-admin' && ! $user->two_factor_enabled) {
            $reasons[] = 'super-admin sans double authentification';
        }

        return array_values(array_unique($reasons));
    }

    /**
     * @return array<string, string[]>
     */
    private function duplicateNames($staff): array
    {
        return $staff
            ->filter(fn (User $user) => $user->is_active && trim((string) $user->first_name) !== '')
            ->groupBy(fn (User $user) => mb_strtolower(trim(($user->first_name ?? '').' '.($user->last_name ?? ''))))
            ->filter(fn ($group) => $group->count() > 1)
            ->map(fn ($group) => $group->pluck('email')->all())
            ->all();
    }
}
