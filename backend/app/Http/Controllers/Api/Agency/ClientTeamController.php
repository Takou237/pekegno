<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\ClientTeamRole;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationTeamMember;
use App\Services\ActivityLogger;
use App\Services\AgencyAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Équipe client Agency : rôles métier (≠ rôles applicatifs), membres
 * affectés aux prestations, et vue globale de tous les membres.
 */
class ClientTeamController extends Controller
{
    public function __construct(
        private readonly AgencyAccessService $access,
        private readonly ActivityLogger $logger,
    ) {}

    public function roles(Request $request): JsonResponse
    {
        $roles = ClientTeamRole::query()
            ->when($request->department_id, fn ($q, $id) => $q->where(fn ($w) => $w->where('department_id', $id)->orWhereNull('department_id')))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->withCount('members')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $roles]);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $role = ClientTeamRole::create($data);

        $this->logger->log(action: 'created', entityType: 'client-team-role', entityId: $role->id, description: "Rôle d'équipe client « {$role->name} » créé", request: $request);

        return response()->json($role, 201);
    }

    public function updateRole(Request $request, ClientTeamRole $role): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $role->update($data);

        return response()->json($role->fresh());
    }

    public function destroyRole(Request $request, ClientTeamRole $role): JsonResponse
    {
        $role->delete();

        $this->logger->log(action: 'deleted', entityType: 'client-team-role', entityId: $role->id, description: "Rôle d'équipe client « {$role->name} » supprimé", request: $request);

        return response()->json(null, 204);
    }

    /** Pré-remplit les rôles par défaut d'un département. */
    public function seedDefaultRoles(Request $request): JsonResponse
    {
        $data = $request->validate(['department_id' => ['required', 'uuid', 'exists:departments,id']]);

        foreach (ClientTeamRole::DEFAULTS as $name) {
            ClientTeamRole::firstOrCreate(['department_id' => $data['department_id'], 'name' => $name]);
        }

        return $this->roles($request);
    }

    public function members(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        return response()->json([
            'data' => $prestation->teamMembers()->with('user:id,first_name,last_name,email', 'teamRole:id,name,color')->get(),
        ]);
    }

    public function storeMember(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $data = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'client_team_role_id' => ['nullable', 'uuid', 'exists:client_team_roles,id'],
            'is_lead' => ['sometimes', 'boolean'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $exists = $prestation->teamMembers()
            ->where('user_id', $data['user_id'])
            ->where('client_team_role_id', $data['client_team_role_id'] ?? null)
            ->exists();
        abort_if($exists, 422, 'Ce membre a déjà ce rôle sur la prestation.');

        $member = $prestation->teamMembers()->create($data);

        $this->logger->log(
            action: 'team_member_added',
            entityType: 'prestation',
            entityId: $prestation->id,
            description: "Membre ajouté à l'équipe de la prestation {$prestation->reference}",
            newValues: $data,
            request: $request,
            agencyId: $prestation->agency_id,
        );

        return response()->json($member->load('user:id,first_name,last_name,email', 'teamRole:id,name,color'), 201);
    }

    public function updateMember(Request $request, PrestationTeamMember $member): JsonResponse
    {
        $this->access->authorize($request->user(), $member->prestation);

        $data = $request->validate([
            'client_team_role_id' => ['nullable', 'uuid', 'exists:client_team_roles,id'],
            'is_lead' => ['sometimes', 'boolean'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $member->update($data);

        return response()->json($member->fresh()->load('user:id,first_name,last_name,email', 'teamRole:id,name,color'));
    }

    public function destroyMember(Request $request, PrestationTeamMember $member): JsonResponse
    {
        $this->access->authorize($request->user(), $member->prestation);

        $member->delete();

        return response()->json(null, 204);
    }

    /**
     * Vue globale : chaque employé, ses rôles Agency, ses prestations / clients
     * et sa charge (actions ouvertes).
     */
    public function overview(Request $request): JsonResponse
    {
        $prestationIds = $this->access->scopePrestations(Prestation::query(), $request->user())
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->prestation_id, fn ($q, $id) => $q->whereKey($id))
            ->pluck('id');

        $members = PrestationTeamMember::query()
            ->whereIn('prestation_id', $prestationIds)
            ->when($request->client_team_role_id, fn ($q, $id) => $q->where('client_team_role_id', $id))
            ->with('user:id,first_name,last_name,email', 'teamRole:id,name,color', 'prestation:id,reference,name,status,client_id', 'prestation.client:id,first_name,last_name')
            ->get()
            ->groupBy('user_id');

        $openActions = PrestationAction::query()
            ->whereIn('prestation_id', $prestationIds)
            ->whereNotIn('status', PrestationAction::FINISHED_STATUSES)
            ->whereNotNull('assigned_to')
            ->selectRaw('assigned_to, count(*) as total')
            ->groupBy('assigned_to')
            ->pluck('total', 'assigned_to');

        $data = $members->map(function ($rows, $userId) use ($openActions) {
            $user = $rows->first()->user;

            return [
                'user' => $user,
                'roles' => $rows->pluck('teamRole')->filter()->unique('id')->values(),
                'prestations' => $rows->map(fn ($m) => [
                    'id' => $m->prestation?->id,
                    'reference' => $m->prestation?->reference,
                    'name' => $m->prestation?->name,
                    'status' => $m->prestation?->status,
                    'client' => $m->prestation?->client ? trim($m->prestation->client->first_name.' '.$m->prestation->client->last_name) : null,
                    'role' => $m->teamRole?->name,
                    'is_lead' => $m->is_lead,
                ])->values(),
                'prestations_count' => $rows->pluck('prestation_id')->unique()->count(),
                'open_actions' => (int) ($openActions[$userId] ?? 0),
            ];
        })->values();

        return response()->json(['data' => $data]);
    }
}
