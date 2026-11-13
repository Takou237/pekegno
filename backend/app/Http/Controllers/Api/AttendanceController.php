<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Trainer;
use App\Models\TrainingSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    /**
     * Feuille de présence : apprenants inscrits à la session
     * avec leur statut pour le module et la date demandés.
     */
    public function index(TrainingSession $session, Request $request): JsonResponse
    {
        $moduleId = $request->input('course_module_id');
        $sessionDate = $request->input('session_date');
        $this->assertTrainerScope($request, $session, $moduleId);

        return response()->json(['attendances' => $this->roster($session, $moduleId, $sessionDate)]);
    }

    public function bulkUpdate(Request $request, TrainingSession $session): JsonResponse
    {
        $caller = $request->user();
        $trainer = Trainer::forUser($caller);
        $isSessionTrainer = $trainer?->isMainTrainerOf($session) ?? false;
        $isModuleTrainer = $trainer && $trainer->moduleIdsForSession($session) !== [];

        abort_unless(
            $caller->hasPermission('presences.modifier') || $isSessionTrainer || $isModuleTrainer,
            403,
            'Seul le formateur de la session ou un responsable peut saisir les présences.'
        );
        $this->assertTrainerScope($request, $session, $request->input('course_module_id'));

        $data = $request->validate([
            'attendances' => ['required', 'array'],
            'attendances.*.learner_user_id' => ['required', 'uuid', 'exists:users,id'],
            'attendances.*.status' => ['required', 'string', 'in:present,absent'],
            'course_module_id' => ['nullable', 'uuid', 'exists:course_modules,id'],
            'session_date' => ['nullable', 'date'],
        ]);

        $moduleId = $data['course_module_id'] ?? null;
        $sessionDate = $data['session_date'] ?? null;
        $user = $request->user();

        DB::transaction(function () use ($data, $session, $user, $moduleId, $sessionDate) {
            foreach ($data['attendances'] as $item) {
                Attendance::updateOrCreate(
                    [
                        'training_session_id' => $session->id,
                        'learner_user_id' => $item['learner_user_id'],
                        'course_module_id' => $moduleId,
                        'session_date' => $sessionDate,
                    ],
                    [
                        'status' => $item['status'],
                        'recorded_by' => $user->id,
                        'recorded_at' => now(),
                    ]
                );
            }
        });

        return response()->json(['attendances' => $this->roster($session, $moduleId, $sessionDate)]);
    }

    /**
     * Un formateur ne pointe que dans son périmètre : toute la session s'il en
     * est le formateur principal ; sinon seulement le module qui lui est confié
     * dans cette formation. Les responsables (hors formateurs) ne sont pas
     * concernés.
     */
    private function assertTrainerScope(Request $request, TrainingSession $session, ?string $moduleId): void
    {
        $user = $request->user();
        if (! $user || $user->role?->name !== 'formateur') {
            return;
        }

        $trainer = Trainer::forUser($user);
        abort_if($trainer === null, 403, 'Aucun profil formateur lié à ce compte.');

        if ($trainer->isMainTrainerOf($session)) {
            return;
        }

        $myModules = $trainer->moduleIdsForSession($session);
        abort_if($myModules === [], 403, 'Cette session ne fait pas partie de vos formations.');
        abort_unless(
            $moduleId !== null && in_array($moduleId, $myModules, true),
            403,
            'Vous ne pouvez faire l\'appel que pour le module qui vous est confié.'
        );
    }

    /**
     * Construit la liste complète apprenants + statuts pour le module et la date donnés.
     */
    private function roster(TrainingSession $session, ?string $moduleId = null, ?string $sessionDate = null): array
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

        if ($sessionDate) {
            $attendanceQuery->whereDate('session_date', $sessionDate);
        } else {
            $attendanceQuery->whereNull('session_date');
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
