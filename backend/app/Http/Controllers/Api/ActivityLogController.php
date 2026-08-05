<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ActivityLogController extends Controller
{
    #[OA\Get(
        path: '/api/activity-logs',
        summary: 'Journal d\'activité avec filtres et pagination',
        tags: ['Audit'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'entity_type', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'action', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Journal paginé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::query()
            ->with('user:id,first_name,last_name,email', 'agency:id,name,code')
            ->when($request->user_id, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->entity_type, fn ($q, $t) => $q->where('entity_type', $t))
            ->when($request->action, fn ($q, $a) => $q->where('action', $a))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->from, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('created_at', '<=', $d));

        $perPage = min((int) $request->input('per_page', 15), 100);

        return response()->json($query->orderByDesc('created_at')->paginate($perPage));
    }
}
