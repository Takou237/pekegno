<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientAttendanceController extends Controller
{
    #[OA\Get(
        path: '/api/client/attendances',
        summary: 'Lister les présences du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des présences'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Attendance::with([
                'trainingSession:id,course_id,module_id,start_at,status',
                'trainingSession.course:id,name',
                'trainingSession.module:id,name,order_index',
            ])
            ->where('learner_user_id', $request->user()->id);

        if ($request->filled('course_id')) {
            $query->whereHas('trainingSession', fn ($q) => $q->where('course_id', $request->input('course_id')));
        }

        $attendances = $query->orderByDesc('recorded_at')
            ->paginate(min((int) $request->input('per_page', 50), 200));

        return response()->json($attendances);
    }
}
