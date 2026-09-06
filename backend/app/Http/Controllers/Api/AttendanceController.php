<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\TrainingSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    /**
     * Feuille de présence : apprenants inscrits à la session
     * avec leur statut pour le module demandé.
     */
    public function index(TrainingSession $session, Request $request): JsonResponse
    {
        $moduleId = $request->input('course_module_id');

        return response()->json(['attendances' => $this->roster($session, $moduleId)]);
    }

    public function bulkUpdate(Request $request, TrainingSession $session): JsonResponse
    {
        $data = $request->validate([
            'attendances' => ['required', 'array'],
            'attendances.*.learner_user_id' => ['required', 'uuid', 'exists:users,id'],
            'attendances.*.status' => ['required', 'string', 'in:present,absent'],
            'course_module_id' => ['nullable', 'uuid', 'exists:course_modules,id'],
        ]);

        $moduleId = $data['course_module_id'] ?? null;
        $user = $request->user();

        DB::transaction(function () use ($data, $session, $user, $moduleId) {
            foreach ($data['attendances'] as $item) {
                Attendance::updateOrCreate(
                    [
                        'training_session_id' => $session->id,
                        'learner_user_id' => $item['learner_user_id'],
                        'course_module_id' => $moduleId,
                    ],
                    [
                        'status' => $item['status'],
                        'recorded_by' => $user->id,
                        'recorded_at' => now(),
                    ]
                );
            }
        });

        return response()->json(['attendances' => $this->roster($session, $moduleId)]);
    }

    /**
     * Construit la liste complète apprenants + statuts pour le module donné.
     */
    private function roster(TrainingSession $session, ?string $moduleId = null): array
    {
        $session->loadMissing('course');

        $participants = \App\Models\SessionParticipant::where('training_session_id', $session->id)
            ->whereNot('status', 'cancelled')
            ->with(['formationEnrollment.learner:id,first_name,last_name,email'])
            ->get();

        $attendanceQuery = Attendance::where('training_session_id', $session->id);

        if ($moduleId) {
            $attendanceQuery->where('course_module_id', $moduleId);
        } else {
            $attendanceQuery->whereNull('course_module_id');
        }

        $byUser = $attendanceQuery->get()->keyBy('learner_user_id');

        return $participants->map(function (\App\Models\SessionParticipant $participant) use ($byUser) {
            $enrollment = $participant->formationEnrollment;
            $learner = $enrollment?->learner;
            $attendance = $learner ? $byUser->get($learner->id) : null;

            return [
                'formation_enrollment_id' => $enrollment?->id,
                'session_participant_id' => $participant->id,
                'learner_user_id' => $learner?->id,
                'learner' => [
                    'id' => $learner?->id,
                    'first_name' => $learner?->first_name,
                    'last_name' => $learner?->last_name,
                    'email' => $learner?->email,
                ],
                'status' => $attendance?->status,
                'recorded_at' => $attendance?->recorded_at?->toISOString(),
            ];
        })->values()->all();
    }
}
