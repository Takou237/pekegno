<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\FormationEnrollment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientEnrollmentController extends Controller
{
    #[OA\Get(
        path: '/api/client/enrollments',
        summary: 'Lister les inscriptions (formations) du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des inscriptions'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $enrollments = FormationEnrollment::with([
                'course:id,name,code,mode,description,cover_image,duration_hours',
                'invoice:id,number,validation_status,status,total_amount,amount_paid',
                'sessionParticipants.session:id,course_id,start_at,status',
            ])
            ->where('learner_user_id', $request->user()->id)
            ->orderByDesc('enrolled_at')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($enrollments);
    }
}
