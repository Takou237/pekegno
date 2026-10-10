<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Department;
use App\Models\Role;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\AgencyAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Annuaire des équipiers Agency (calque du modèle employé) : CRUD, liaison /
 * création de compte (rôle community-manager), périmètre agence/département.
 */
class TeamMemberController extends Controller
{
    public function __construct(
        private readonly AgencyAccessService $access,
        private readonly ActivityLogger $logger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $departmentId = $request->input('department_id');
        $agencyId = $request->input('agency_id');

        if ($departmentId) {
            $department = Department::findOrFail($departmentId);
            $agencyId = $agencyId ?? $department->agency_id;
        }

        if ($agencyId) {
            abort_unless($this->access->canAccessAgency($request->user(), $agencyId), 403, 'Agence hors de votre périmètre.');
        }

        $members = TeamMember::query()
            ->with(['user:id,first_name,last_name,email', 'agency:id,name', 'department:id,name'])
            ->when($agencyId, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($departmentId, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->input('linked') === 'true', fn ($q) => $q->whereNotNull('user_id'))
            ->when($request->input('linked') === 'false', fn ($q) => $q->whereNull('user_id'))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $needle = '%'.mb_strtolower($request->string('search')->toString()).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw('lower(first_name) like ?', [$needle])
                    ->orWhereRaw('lower(last_name) like ?', [$needle])
                    ->orWhereRaw('lower(email) like ?', [$needle])
                    ->orWhereRaw('lower(phone) like ?', [$needle]));
            })
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($members);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $agencyId = $this->resolveAgencyId($data);

        if ($agencyId) {
            abort_unless($this->access->canAccessAgency($request->user(), $agencyId), 403, 'Agence hors de votre périmètre.');
        }

        $member = TeamMember::create($data + ['agency_id' => $agencyId]);

        $this->logger->log(
            action: 'created',
            entityType: 'team-member',
            entityId: $member->id,
            description: "Équipier {$member->full_name} créé",
            newValues: ['email' => $member->email],
            agencyId: $member->agency_id,
        );

        return response()->json($member->load(['user:id,first_name,last_name,email', 'agency:id,name', 'department:id,name']), 201);
    }

    public function update(Request $request, TeamMember $teamMember): JsonResponse
    {
        $data = $this->validated($request, update: true);

        if ($teamMember->agency_id) {
            abort_unless($this->access->canAccessAgency($request->user(), $teamMember->agency_id), 403, 'Agence hors de votre périmètre.');
        }

        if (array_key_exists('department_id', $data) || array_key_exists('agency_id', $data)) {
            $data['agency_id'] = $this->resolveAgencyId($data + $teamMember->only(['agency_id', 'department_id']));
            if ($data['agency_id']) {
                abort_unless($this->access->canAccessAgency($request->user(), $data['agency_id']), 403, 'Agence hors de votre périmètre.');
            }
        }

        $teamMember->update($data);

        return response()->json($teamMember->fresh()->load(['user:id,first_name,last_name,email', 'agency:id,name', 'department:id,name']));
    }

    public function destroy(Request $request, TeamMember $teamMember): JsonResponse
    {
        if ($teamMember->agency_id) {
            abort_unless($this->access->canAccessAgency($request->user(), $teamMember->agency_id), 403, 'Agence hors de votre périmètre.');
        }

        $teamMember->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'team-member',
            entityId: $teamMember->id,
            description: "Équipier {$teamMember->full_name} supprimé",
            agencyId: $teamMember->agency_id,
        );

        return response()->json(['message' => 'Équipier supprimé.']);
    }

    /**
     * Comptes community-manager non liés à un équipier (pour la liaison),
     * cherchables et filtrables par agence.
     */
    public function availableUsers(Request $request): JsonResponse
    {
        $linkedIds = TeamMember::pluck('user_id')->filter();

        $users = User::query()
            ->whereHas('role', fn ($q) => $q->where('name', 'community-manager'))
            ->when($linkedIds->isNotEmpty(), fn ($q) => $q->whereNotIn('id', $linkedIds))
            ->when($request->agency_id, fn ($q, $id) => $q->whereHas('assignments', fn ($a) => $a->where('agencies.id', $id)))
            ->when($request->filled('search'), function ($q) use ($request) {
                $needle = '%'.mb_strtolower($request->string('search')->toString()).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw('lower(first_name) like ?', [$needle])
                    ->orWhereRaw('lower(last_name) like ?', [$needle])
                    ->orWhereRaw('lower(email) like ?', [$needle]));
            })
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'email', 'is_active']);

        return response()->json($users);
    }

    /**
     * Lie un compte community-manager existant à l'équipier.
     */
    public function linkUser(Request $request, TeamMember $teamMember): JsonResponse
    {
        if ($teamMember->agency_id) {
            abort_unless($this->access->canAccessAgency($request->user(), $teamMember->agency_id), 403, 'Agence hors de votre périmètre.');
        }

        $data = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::findOrFail($data['user_id']);
        abort_unless($user->role?->name === 'community-manager', 422, 'Le compte lié doit avoir le rôle community-manager.');
        abort_unless(! TeamMember::where('user_id', $user->id)->exists(), 422, 'Ce compte est déjà lié à un équipier.');

        $teamMember->update(['user_id' => $user->id]);
        $this->ensureEmployeeProfile($user->fresh(), $teamMember->agency_id);

        return response()->json($teamMember->fresh()->load('user:id,first_name,last_name,email'));
    }

    public function unlinkUser(Request $request, TeamMember $teamMember): JsonResponse
    {
        if ($teamMember->agency_id) {
            abort_unless($this->access->canAccessAgency($request->user(), $teamMember->agency_id), 403, 'Agence hors de votre périmètre.');
        }

        $teamMember->update(['user_id' => null]);

        return response()->json($teamMember->fresh());
    }

    /**
     * Crée le compte community-manager de l'équipier et le lie aussitôt.
     */
    public function createAccount(Request $request, TeamMember $teamMember): JsonResponse
    {
        if ($teamMember->agency_id) {
            abort_unless($this->access->canAccessAgency($request->user(), $teamMember->agency_id), 403, 'Agence hors de votre périmètre.');
        }

        abort_unless($teamMember->user_id === null, 422, 'Cet équipier a déjà un compte lié.');

        $data = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        ]);

        $role = Role::where('name', 'community-manager')->firstOrFail();

        $user = DB::transaction(function () use ($data, $teamMember, $role) {
            $user = User::create([
                'username' => $data['email'],
                'email' => $data['email'],
                'password' => Hash::make('password'),
                'first_name' => $teamMember->first_name,
                'last_name' => $teamMember->last_name,
                'phone' => $teamMember->phone,
                'role_id' => $role->id,
                'is_active' => true,
            ]);

            if ($teamMember->agency_id) {
                $user->assignments()->attach($teamMember->agency_id, [
                    'is_primary' => false,
                    'is_department_chief' => false,
                    'department_id' => $teamMember->department_id,
                ]);
            }

            $teamMember->update(['user_id' => $user->id, 'email' => $teamMember->email ?? $user->email]);

            $this->ensureEmployeeProfile($user, $teamMember->agency_id);

            return $user;
        });

        $this->logger->log(
            action: 'created',
            entityType: 'user',
            entityId: $user->id,
            description: "Compte community-manager créé pour {$teamMember->full_name}",
            newValues: ['email' => $user->email],
            agencyId: $teamMember->agency_id,
        );

        return response()->json($teamMember->fresh()->load('user:id,first_name,last_name,email'), 201);
    }

    private function validated(Request $request, bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return $request->validate([
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'first_name' => [$required, 'string', 'max:150'],
            'last_name' => [$required, 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'commission_type' => [$required, Rule::in(TeamMember::COMMISSION_TYPES)],
            'commission_value' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function resolveAgencyId(array $data): ?string
    {
        if (! empty($data['agency_id'])) {
            return $data['agency_id'];
        }

        if (! empty($data['department_id'])) {
            return Department::where('id', $data['department_id'])->value('agency_id');
        }

        return null;
    }

    /**
     * Un équipier avec compte apparaît dans la liste des employés de l'agence
     * (calque employé) : profil Commercial kind=employe créé à la liaison,
     * comme pour caissier/comptable (annuaire RH unifié).
     */
    private function ensureEmployeeProfile(User $user, ?string $agencyId): void
    {
        $exists = \App\Models\Commercial::query()->where('user_id', $user->id)->exists();

        if ($exists) {
            return;
        }

        \App\Models\Commercial::create([
            'user_id' => $user->id,
            'agency_id' => $agencyId,
            'kind' => 'employe',
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'points_balance' => 0,
            'is_active' => (bool) $user->is_active,
        ]);
    }
}
