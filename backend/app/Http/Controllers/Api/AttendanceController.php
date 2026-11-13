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
    /**
     * Présences par séance (MVP §10, CdC §7) : chaque session du périmètre avec
     * ses séances datées (date, module, présents / absents / retards, appel
     * fait par qui et quand). Formateur (ou `as_trainer=1`) : ses sessions.
     */
    public function seances(Request $request): JsonResponse
    {
        $user = $request->user();
        $asTrainer = $user?->role?->name === 'formateur' || $request->boolean('as_trainer');
        $trainer = $asTrainer ? Trainer::forUser($user) : null;

        $sessions = TrainingSession::query()
            ->with(['course:id,name,code', 'trainer:id,first_name,last_name', 'agency:id,name'])
            ->where('status', '!=', TrainingSession::STATUS_CANCELLED)
            ->when($request->filled('course_id'), fn ($q) => $q->where('course_id', $request->input('course_id')))
            ->when($request->filled('agency_id'), fn ($q) => $q->where('agency_id', $request->input('agency_id')))
            ->when($request->filled('training_session_id'), fn ($q) => $q->whereKey($request->input('training_session_id')));

        if ($asTrainer) {
            $sessions->whereIn('id', $trainer ? $trainer->accessibleSessionIds() : []);
        } else {
            $agencyIds = app(\App\Services\ScopeService::class)->agencyIds($user);
            if ($agencyIds !== null) {
                $sessions->where(fn ($q) => $q->whereIn('agency_id', $agencyIds)
                    ->orWhereHas('course', fn ($c) => $c->whereIn('agency_id', $agencyIds)));
            }
        }

        $page = $sessions->orderByDesc('start_at')->paginate(min((int) $request->input('per_page', 20), 100));
        $ids = collect($page->items())->pluck('id');

        // Formateur de module : seulement ses modules dans chaque session.
        $moduleFilter = null;
        if ($trainer) {
            $moduleFilter = \App\Models\SessionModuleTrainer::where('trainer_id', $trainer->id)
                ->whereIn('training_session_id', $ids)
                ->get()
                ->groupBy('training_session_id')
                ->map(fn ($rows) => $rows->pluck('course_module_id')->all());
        }

        $seances = DB::table('attendances')
            ->leftJoin('course_modules', 'course_modules.id', '=', 'attendances.course_module_id')
            ->leftJoin('users', 'users.id', '=', 'attendances.recorded_by')
            ->whereIn('attendances.training_session_id', $ids)
            ->groupBy('attendances.training_session_id', 'attendances.session_date', 'attendances.course_module_id', 'course_modules.name')
            ->selectRaw("attendances.training_session_id, attendances.session_date, attendances.course_module_id, course_modules.name as module_name,
                count(*) as total,
                sum(case when attendances.status = 'present' then 1 else 0 end) as present,
                sum(case when attendances.status = 'absent' then 1 else 0 end) as absent,
                sum(case when attendances.status = 'late' then 1 else 0 end) as late,
                sum(case when attendances.status = 'excused' then 1 else 0 end) as excused,
                max(attendances.recorded_at) as recorded_at,
                max(trim(coalesce(users.first_name, '') || ' ' || coalesce(users.last_name, ''))) as recorded_by")
            ->orderByDesc('attendances.session_date')
            ->get()
            ->groupBy('training_session_id');

        $data = collect($page->items())->map(function (TrainingSession $s) use ($seances, $trainer, $moduleFilter) {
            $isMain = ! $trainer || $s->trainer_id === $trainer->id;
            $rows = collect($seances->get($s->id, []))
                ->filter(fn ($r) => $isMain || in_array($r->course_module_id, $moduleFilter?->get($s->id, []) ?? [], true))
                ->map(fn ($r) => [
                    'date' => $r->session_date ? substr((string) $r->session_date, 0, 10) : null,
                    'module_id' => $r->course_module_id,
                    'module_name' => $r->module_name,
                    'total' => (int) $r->total,
                    'present' => (int) $r->present,
                    'absent' => (int) $r->absent,
                    'late' => (int) $r->late,
                    'excused' => (int) $r->excused,
                    'recorded_at' => $r->recorded_at,
                    'recorded_by' => $r->recorded_by ?: null,
                ])->values();

            return [
                'id' => $s->id,
                'course' => $s->course ? ['id' => $s->course->id, 'name' => $s->course->name, 'code' => $s->course->code] : null,
                'agency' => $s->agency?->name,
                'trainer' => $s->trainer ? trim($s->trainer->first_name.' '.$s->trainer->last_name) : null,
                'start_at' => $s->start_at?->toISOString(),
                'end_at' => $s->end_at?->toISOString(),
                'status' => $s->status,
                'seances' => $rows,
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage()],
        ]);
    }

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
