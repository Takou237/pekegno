<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\FormationEnrollment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientLearnerController extends Controller
{
    /**
     * Fiche apprenant : profil du client + formations suivies avec progression
     * par module (présences présentes / total enregistrées) et observations visibles.
     */
    #[OA\Get(
        path: '/api/client/learner-profile',
        summary: 'Fiche apprenant du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Fiche apprenant'),
        ]
    )]
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;

        $enrollments = FormationEnrollment::with([
                'course:id,name,code,description,cover_image,mode',
                'course.modules:id,course_id,name,order_index',
                'invoice:id,number,validation_status,status,total_amount,amount_paid',
            ])
            ->where('learner_user_id', $userId)
            ->get();

        $courses = $enrollments->map(function (FormationEnrollment $enrollment) use ($userId) {
            $modules = $enrollment->course->modules->map(function ($module) use ($userId) {
                $attendances = Attendance::where('learner_user_id', $userId)
                    ->where('course_module_id', $module->id)
                    ->get();

                return [
                    'id' => $module->id,
                    'name' => $module->name,
                    'order_index' => $module->order_index,
                    'presences' => [
                        'present' => $attendances->where('status', Attendance::STATUS_PRESENT)->count(),
                        'absent' => $attendances->where('status', Attendance::STATUS_ABSENT)->count(),
                        'recorded' => $attendances->count(),
                    ],
                ];
            });

            return [
                'id' => $enrollment->id,
                'enrolled_at' => $enrollment->enrolled_at,
                'status' => $enrollment->status,
                'course' => $enrollment->course->only(['id', 'name', 'code', 'description', 'cover_image', 'mode']),
                'invoice' => $enrollment->invoice ? $enrollment->invoice->only(['id', 'number', 'validation_status', 'status', 'total_amount', 'amount_paid']) : null,
                'modules' => $modules->values(),
            ];
        });

        return response()->json([
            'profile' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'client_number' => $user->client_number,
                'phone' => $user->phone,
            ],
            'courses' => $courses->values(),
        ]);
    }
}
