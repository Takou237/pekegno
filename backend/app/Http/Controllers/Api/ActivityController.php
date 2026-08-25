<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class ActivityController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/activities',
        summary: 'Lister les activités (filtres)',
        tags: ['Activités'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subject_type', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'subject_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'type', in: 'query', schema: new OA\Schema(type: 'string', enum: ['call','meeting','email','whatsapp','note','followup'])),
            new OA\Parameter(name: 'assigned_to', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'overdue', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Activity::query()->with(['assignee', 'creator']);

        if ($request->filled('subject_type') && $request->filled('subject_id')) {
            $query->forSubject($request->input('subject_type'), $request->input('subject_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->input('assigned_to'));
        }

        if ($request->boolean('overdue')) {
            $query->overdue();
        }

        if ($request->boolean('completed')) {
            $query->whereNotNull('completed_at');
        }

        if ($request->boolean('upcoming')) {
            $query->upcoming();
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $activities = $query->orderByDesc('due_at')->paginate($perPage);

        return response()->json($activities);
    }

    #[OA\Post(
        path: '/api/activities',
        summary: 'Créer une activité',
        tags: ['Activités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Activité créée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', 'string', 'max:50'],
            'subject_id' => ['required', 'uuid'],
            'assigned_to' => ['nullable', 'uuid', 'exists:users,id'],
            'type' => ['required', 'string', 'in:' . implode(',', Activity::TYPES)],
            'title' => ['required', 'string', 'max:200'],
            'notes' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
        ]);

        $activity = Activity::create($data + [
            'created_by' => $request->user()->id,
        ]);

        $this->logger->log(
            action: 'created',
            entityType: 'activity',
            entityId: $activity->id,
            description: "Activité «{$activity->title}» créée",
            newValues: ['type' => $activity->type, 'subject_type' => $activity->subject_type],
            request: $request,
        );

        return response()->json($activity->fresh()->load(['assignee', 'creator']), 201);
    }

    #[OA\Get(
        path: '/api/activities/{activity}',
        summary: 'Détail d\'une activité',
        tags: ['Activités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail'),
        ]
    )]
    public function show(Activity $activity): JsonResponse
    {
        return response()->json($activity->load(['assignee', 'creator', 'subject']));
    }

    #[OA\Put(
        path: '/api/activities/{activity}',
        summary: 'Modifier une activité',
        tags: ['Activités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Activité modifiée'),
        ]
    )]
    public function update(Request $request, Activity $activity): JsonResponse
    {
        $data = $request->validate([
            'assigned_to' => ['nullable', 'uuid', 'exists:users,id'],
            'type' => ['sometimes', 'required', 'string', 'in:' . implode(',', Activity::TYPES)],
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'notes' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
        ]);

        $activity->update($data);

        return response()->json($activity->fresh()->load(['assignee', 'creator']));
    }

    #[OA\Post(
        path: '/api/activities/{activity}/complete',
        summary: 'Marquer une activité comme complétée',
        tags: ['Activités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Activité complétée'),
        ]
    )]
    public function complete(Request $request, Activity $activity): JsonResponse
    {
        abort_if($activity->completed_at !== null, 422, 'Cette activité est déjà complétée.');

        $data = $request->validate([
            'outcome' => ['nullable', 'string', 'max:255'],
        ]);

        $activity->complete($data['outcome'] ?? null);

        $this->logger->log(
            action: 'completed',
            entityType: 'activity',
            entityId: $activity->id,
            description: "Activité «{$activity->title}» complétée",
            newValues: ['completed_at' => $activity->fresh()->completed_at, 'outcome' => $activity->outcome],
            request: $request,
        );

        return response()->json($activity->fresh()->load(['assignee', 'creator']));
    }

    #[OA\Delete(
        path: '/api/activities/{activity}',
        summary: 'Supprimer une activité',
        tags: ['Activités'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Supprimée'),
        ]
    )]
    public function destroy(Activity $activity): JsonResponse
    {
        $title = $activity->title;
        $activity->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'activity',
            entityId: $activity->id,
            description: "Activité «{$title}» supprimée",
        );

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/crm/timeline',
        summary: 'Timeline unifiée CRM (activités + factures + paiements + opportunités)',
        tags: ['CRM'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subject_type', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'subject_id', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Timeline'),
        ]
    )]
    public function timeline(Request $request): JsonResponse
    {
        $subjectType = $request->input('subject_type');
        $subjectId = $request->input('subject_id');

        abort_unless($subjectType && $subjectId, 422, 'subject_type et subject_id sont requis.');

        $activities = Activity::forSubject($subjectType, $subjectId)
            ->with(['assignee:id,first_name,last_name', 'creator:id,first_name,last_name'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($activities);
    }
}
