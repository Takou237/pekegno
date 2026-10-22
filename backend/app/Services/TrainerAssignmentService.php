<?php

namespace App\Services;

use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Affectation d'un animateur à une session de formation.
 *
 * N'importe quel compte interne (tous rôles) peut animer une session. Pour
 * conserver `training_sessions.trainer_id` comme unique source de vérité, un
 * profil formateur est créé à la volée pour le compte retenu
 * (`trainers.user_id` est unique) : statistiques, tableau de bord et
 * synchronisation inter-agences restent ainsi cohérents.
 */
class TrainerAssignmentService
{
    /** Les comptes clients ne sont pas des formateurs. */
    public const CLIENT_ROLE = 'client';

    public function __construct(
        private readonly ScopeService $scopeService,
    ) {
    }

    /**
     * Identifiant du profil formateur à affecter à une session.
     *
     * - `trainer_user_id` prioritaire : n'importe quel compte interne ;
     * - sinon `trainer_id` : profil formateur existant (notamment sans compte).
     */
    public function resolveTrainerId(?string $trainerId, ?string $trainerUserId): ?string
    {
        if (! $trainerUserId) {
            return $trainerId;
        }

        $user = User::find($trainerUserId);

        if (! $user) {
            return $trainerId;
        }

        return $this->profileForUser($user)->id;
    }

    /**
     * Profil formateur du compte : créé à la volée s'il n'existe pas encore.
     * Un profil archivé (soft delete) est réactivé plutôt que dupliqué, la
     * colonne `trainers.user_id` étant unique.
     */
    public function profileForUser(User $user): Trainer
    {
        $existing = Trainer::withTrashed()->where('user_id', $user->id)->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            return $existing;
        }

        return Trainer::create([
            'user_id' => $user->id,
            'agency_id' => $this->agencyIdFor($user),
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => (bool) $user->is_active,
        ]);
    }

    /**
     * Personnes pouvant animer une session : tous les comptes internes (tous
     * rôles) et les profils formateurs sans compte (intervenants externes).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function candidates(
        ?User $actor,
        ?string $agencyId = null,
        ?string $roleName = null,
        ?string $search = null,
        int $perPage = 20,
    ): Collection {
        $targetAgencyIds = $this->targetAgencyIds($actor, $agencyId);
        $search = trim((string) $search);

        $users = $this->candidateUsers($roleName, $search, $targetAgencyIds, $perPage);
        $profiles = $this->candidateProfiles($search, $targetAgencyIds, $perPage);

        $trainerIds = Trainer::whereIn('user_id', $users->pluck('id')->all())
            ->pluck('id', 'user_id');

        $items = $users->map(fn (User $user) => [
            'kind' => 'user',
            'user_id' => $user->id,
            'trainer_id' => $trainerIds[$user->id] ?? null,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role?->name,
            'agency' => $this->agencyFor($user),
            'is_active' => (bool) $user->is_active,
        ]);

        $items = $items->concat($profiles->map(fn (Trainer $trainer) => [
            'kind' => 'profile',
            'user_id' => null,
            'trainer_id' => $trainer->id,
            'first_name' => $trainer->first_name,
            'last_name' => $trainer->last_name,
            'email' => $trainer->email,
            'phone' => $trainer->phone,
            'role' => 'formateur',
            'agency' => $trainer->agency ? [
                'id' => $trainer->agency->id,
                'name' => $trainer->agency->name,
            ] : null,
            'is_active' => (bool) $trainer->is_active,
        ]));

        return $items
            ->sortBy(fn (array $item) => $this->sortKey($item))
            ->values();
    }

    /**
     * Rôles internes proposés dans le filtre de l'interface.
     *
     * @return array<int, string>
     */
    public function internalRoles(): array
    {
        return Role::query()
            ->where('name', '!=', self::CLIENT_ROLE)
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }

    /**
     * Agences retenues pour la liste : périmètre de l'appelant, restreint à
     * l'agence demandée lorsqu'elle fait partie du périmètre.
     *
     * @return array<int, string>|null null = aucune restriction
     */
    private function targetAgencyIds(?User $actor, ?string $agencyId): ?array
    {
        // Note : when $agencyId is null, on retourne null = pas de restriction.
        // Cela permet d'afficher tous les utilisateurs de la plateforme,
        // indépendamment de leur agence / pays / département.
        if (! $agencyId) {
            return null;
        }

        $scopeIds = $this->scopeService->agencyIds($actor);

        if ($scopeIds === null) {
            return [$agencyId];
        }

        return in_array($agencyId, $scopeIds, true) ? [$agencyId] : $scopeIds;
    }

    /**
     * @param  array<int, string>|null  $targetAgencyIds
     * @return Collection<int, User>
     */
    private function candidateUsers(?string $roleName, string $search, ?array $targetAgencyIds, int $perPage): Collection
    {
        $query = User::query()
            ->with(['role:id,name', 'assignments:id,name', 'commercialProfile:id,user_id,agency_id'])
            ->whereHas('role', fn ($q) => $q->where('name', '!=', self::CLIENT_ROLE))
            ->when($roleName, fn ($q, $v) => $q->whereHas('role', fn ($rq) => $rq->where('name', $v)))
            ->when($search !== '', fn ($q) => $q->where(fn ($sq) => $this->applySearch($sq, $search)));

        if ($targetAgencyIds !== null) {
            $query->where(function ($q) use ($targetAgencyIds) {
                $q->whereHas('assignments', fn ($aq) => $aq->whereIn('agency_id', $targetAgencyIds))
                    ->orWhereHas('commercialProfile', fn ($cq) => $cq->whereIn('agency_id', $targetAgencyIds));
            });
        }

        return $query->orderBy('first_name')->orderBy('last_name')->limit($perPage)->get();
    }

    /**
     * @param  array<int, string>|null  $targetAgencyIds
     * @return Collection<int, Trainer>
     */
    private function candidateProfiles(string $search, ?array $targetAgencyIds, int $perPage): Collection
    {
        $query = Trainer::query()
            ->with('agency:id,name')
            ->whereNull('user_id')
            ->when($search !== '', fn ($q) => $q->where(fn ($sq) => $this->applySearch($sq, $search)));

        if ($targetAgencyIds !== null) {
            $query->whereIn('agency_id', $targetAgencyIds);
        }

        return $query->orderBy('first_name')->orderBy('last_name')->limit($perPage)->get();
    }

    /**
     * Recherche multi-termes sur le nom et l'email (insensible à la casse).
     * `LOWER(...) LIKE` est portable entre PostgreSQL (production) et SQLite
     * (tests) contrairement à l'opérateur `ilike`.
     */
    private function applySearch($query, string $search): void
    {
        foreach (preg_split('/\s+/', $search) ?: [] as $term) {
            if ($term === '') {
                continue;
            }

            $needle = '%'.mb_strtolower($term).'%';

            $query->where(function ($termQuery) use ($needle) {
                $termQuery->whereRaw('LOWER(first_name) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(last_name) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$needle]);
            });
        }
    }

    /**
     * @return array{id: string, name: string}|null
     */
    private function agencyFor(User $user): ?array
    {
        $assignment = $user->assignments->sortByDesc(fn ($agency) => $agency->pivot->is_primary ? 1 : 0)->first();

        if ($assignment) {
            return ['id' => $assignment->id, 'name' => $assignment->name];
        }

        $agencyId = $user->commercialProfile?->agency_id;

        if (! $agencyId) {
            return null;
        }

        $agency = DB::table('agencies')->where('id', $agencyId)->first();

        return $agency ? ['id' => $agency->id, 'name' => $agency->name] : null;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function sortKey(array $item): string
    {
        $name = trim(($item['first_name'] ?? '').' '.($item['last_name'] ?? ''));

        return mb_strtolower($name !== '' ? $name : (string) ($item['email'] ?? ''));
    }

    private function agencyIdFor(User $user): ?string
    {
        return DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->orderByDesc('is_primary')
            ->value('agency_id')
            ?? DB::table('commercials')->where('user_id', $user->id)->value('agency_id');
    }
}
