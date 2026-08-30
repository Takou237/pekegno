<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\FormationEnrollment;
use App\Models\TrainingSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    /**
     * Feuille de présence : tous les apprenants inscrits à la formation du cours
     * (hors annulés) avec leur statut pour cette session.
     */
    public function index(TrainingSession $session): JsonResponse
    {
        return response()->json(['attendances' => $this->roster($session)]);
    }

    public function bulkUpdate(Request $request, TrainingSession $session): JsonResponse
    {
        $session->loadMissing('course');

        $data = $request->validate([
            'attendances' => ['required', 'array'],
            'attendances.*.learner_user_id' => ['required', 'uuid', 'exists:users,id'],
            'attendances.*.status' => ['required', 'string', 'in:present,absent'],
        ]);

        $user = $request->user();

        DB::transaction(function () use ($data, $session, $user) {
            foreach ($data['attendances'] as $item) {
                Attendance::updateOrCreate(
                    [
                        'training_session_id' => $session->id,
                        'learner_user_id' => $item['learner_user_id'],
                    ],
                    [
                        'status' => $item['status'],
                        'recorded_by' => $user->id,
                        'recorded_at' => now(),
                    ]
                );
            }
        });

        return response()->json(['attendances' => $this->roster($session)]);
    }
    /**
     * Construit la liste complète apprenants + statuts pour la feuille.
     */
    private function roster(TrainingSession $session): array
    {
        $session->loadMissing('course');

        $participants = \App\Models\SessionParticipant::where('training_session_id', $session->id)
            ->whereNot('status', 'cancelled')
            ->with(['formationEnrollment.learner:id,first_name,last_name,email'])
            ->get();

        $byUser = Attendance::where('training_session_id', $session->id)
            ->get()
            ->keyBy('learner_user_id');

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