<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commercial;
use App\Models\Company;
use App\Models\Opportunity;
use App\Models\Prospect;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class OpportunityController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    private function scopeByRole($query, ?User $user)
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if (in_array($user->role?->name, ['super-admin', 'direction-generale'], true)) {
            return $query;
        }

        if (in_array($user->role?->name, ['responsable-agence', 'responsable-departement'], true)) {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->pluck('agency_id');

            return $query->whereIn('agency_id', $agencyIds);
        }

        if ($user->role?->name === 'commercial' && $user->commercialProfile) {
            return $query->where('commercial_id', $user->commercialProfile->id);
        }

        return $query->whereRaw('1 = 0');
    }

    #[OA\Get(
        path: '/api/opportunities',
        summary: 'Lister les opportunités (pipeline)',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'stage', in: 'query', schema: new OA\Schema(type: 'string', enum: ['new','contacted','qualified','proposal','negotiation','won','lost'])),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = $this->scopeByRole(
            Opportunity::query()->with(['prospect', 'company', 'commercial', 'agency', 'client']),
            $request->user()
        );

        if ($request->filled('stage')) {
            $query->ofStage($request->input('stage'));
        }

        if ($request->filled('commercial_id')) {
            $query->ofCommercial($request->input('commercial_id'));
        }

        if ($request->filled('agency_id')) {
            $query->ofAgency($request->input('agency_id'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('title', 'like', "%{$s}%"));
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $opportunities = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($opportunities);
    }

    #[OA\Post(
        path: '/api/opportunities',
        summary: 'Créer une opportunité',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Opportunité créée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'prospect_id' => ['nullable', 'uuid', 'exists:prospects,id'],
            'client_id' => ['nullable', 'uuid', 'exists:users,id'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'agency_id' => ['required', 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'commercial_id' => ['required', 'uuid', 'exists:commercials,id'],
            'expected_amount' => ['nullable', 'numeric', 'min:0'],
            'expected_close_date' => ['nullable', 'date'],
        ]);

        $opportunity = Opportunity::create($data + ['stage' => 'new']);

        $this->logger->log(
            action: 'created',
            entityType: 'opportunity',
            entityId: $opportunity->id,
            description: "Opportunité «{$opportunity->title}» créée",
            newValues: ['stage' => 'new', 'expected_amount' => $opportunity->expected_amount],
            request: $request,
        );

        return response()->json($opportunity->fresh()->load(['prospect', 'company', 'commercial', 'agency']), 201);
    }

    #[OA\Get(
        path: '/api/opportunities/{opportunity}',
        summary: 'Détail d\'une opportunité',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail'),
        ]
    )]
    public function show(Request $request, Opportunity $opportunity): JsonResponse
    {
        $this->scopeByRole(Opportunity::whereKey($opportunity->id), $request->user())->firstOrFail();

        return response()->json($opportunity->load([
            'prospect', 'client', 'company', 'department', 'commercial', 'agency', 'activities',
        ]));
    }

    #[OA\Put(
        path: '/api/opportunities/{opportunity}',
        summary: 'Modifier une opportunité',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Opportunité modifiée'),
        ]
    )]
    public function update(Request $request, Opportunity $opportunity): JsonResponse
    {
        $this->scopeByRole(Opportunity::whereKey($opportunity->id), $request->user())->firstOrFail();

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'prospect_id' => ['nullable', 'uuid', 'exists:prospects,id'],
            'client_id' => ['nullable', 'uuid', 'exists:users,id'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'agency_id' => ['sometimes', 'required', 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'commercial_id' => ['sometimes', 'required', 'uuid', 'exists:commercials,id'],
            'expected_amount' => ['nullable', 'numeric', 'min:0'],
            'expected_close_date' => ['nullable', 'date'],
        ]);

        $opportunity->update($data);

        return response()->json($opportunity->fresh()->load(['prospect', 'company', 'commercial', 'agency']));
    }

    #[OA\Post(
        path: '/api/opportunities/{opportunity}/stage',
        summary: 'Changer le stage d\'une opportunité (transitions libres tracées)',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Stage changé'),
            new OA\Response(response: 422, description: 'Stage invalide'),
        ]
    )]
    public function changeStage(Request $request, Opportunity $opportunity): JsonResponse
    {
        $this->scopeByRole(Opportunity::whereKey($opportunity->id), $request->user())->firstOrFail();

        $data = $request->validate([
            'stage' => ['required', 'string', 'in:' . implode(',', Opportunity::STAGES)],
            'loss_reason' => ['required_if:stage,lost', 'nullable', 'string', 'max:500'],
        ]);

        $oldStage = $opportunity->stage;
        $newStage = $data['stage'];

        DB::transaction(function () use ($opportunity, $oldStage, $newStage, $data) {
            $updates = ['stage' => $newStage];

            if ($newStage === 'won') {
                $updates['won_at'] = now();
                $updates['lost_at'] = null;
                $updates['loss_reason'] = null;
            } elseif ($newStage === 'lost') {
                $updates['lost_at'] = now();
                $updates['won_at'] = null;
                $updates['loss_reason'] = $data['loss_reason'] ?? null;
            }

            $opportunity->update($updates);

            $this->logger->log(
                action: 'stage_changed',
                entityType: 'opportunity',
                entityId: $opportunity->id,
                description: "Opportunité «{$opportunity->title}»: {$oldStage} → {$newStage}",
                oldValues: ['stage' => $oldStage],
                newValues: ['stage' => $newStage, 'loss_reason' => $data['loss_reason'] ?? null],
            );
        });

        return response()->json($opportunity->fresh()->load(['prospect', 'company', 'commercial']));
    }

    #[OA\Delete(
        path: '/api/opportunities/{opportunity}',
        summary: 'Supprimer une opportunité',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Supprimée'),
        ]
    )]
    public function destroy(Request $request, Opportunity $opportunity): JsonResponse
    {
        $this->scopeByRole(Opportunity::whereKey($opportunity->id), $request->user())->firstOrFail();

        $title = $opportunity->title;
        $opportunity->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'opportunity',
            entityId: $opportunity->id,
            description: "Opportunité «{$title}» supprimée",
        );

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/opportunities/pipeline',
        summary: 'Vue pipeline (compteur par stage)',
        tags: ['Opportunités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Pipeline'),
        ]
    )]
    public function pipeline(Request $request): JsonResponse
    {
        $query = $this->scopeByRole(Opportunity::query()->open(), $request->user());

        $pipeline = $query->selectRaw('stage, count(*) as count, coalesce(sum(expected_amount), 0) as total_amount')
            ->groupBy('stage')
            ->get();

        return response()->json($pipeline);
    }
}
