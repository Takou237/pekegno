<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreTrainingSessionRequest;
use App\Http\Requests\Api\UpdateTrainingSessionRequest;
use App\Http\Resources\TrainingSessionResource;
use App\Models\Agency;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\TrainingSession;
use App\Services\ScopeService;
use App\Services\TrainerAssignmentService;
use App\Support\AttendanceStats;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class TrainingSessionController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
        private readonly TrainerAssignmentService $trainerService,
    ) {
    }

    /** Réduit la requête au périmètre organisationnel : sessions des agences autorisées (une session hérite de l'agence de son cours sinon de la sienne). */
    private function scopeQuery(Request $request, $query)
    {
        // Formateur : seulement ses sessions (animées, ou d'une formation dont
        // un module lui est confié), quelle que soit l'agence.
        if ($request->user()?->role?->name === 'formateur') {
            $trainer = \App\Models\Trainer::forUser($request->user());

            return $query->whereIn('training_sessions.id', $trainer ? $trainer->accessibleSessionIds() : []);
        }

        // Les sessions sont demandées pour une formation précise (course_id) :
        // le périmètre est déjà porté par ce choix, on n'applique pas le scope
        // d'agence (indispensable pour une formation d'un autre pays).
        if ($request->filled('course_id')) {
            return $query;
        }

        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds === null) {
            return $query;
        }

        return $query->where(function ($q) use ($agencyIds) {
            $q->whereIn('agency_id', $agencyIds)
                ->orWhereHas('course', fn ($course) => $course->whereIn('agency_id', $agencyIds)->orWhereNull('agency_id'));
        });
    }

    #[OA\Get(
        path: '/api/training-sessions',
        summary: 'Lister les sessions de formation',
        tags: ['Académie — Sessions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course_id', in: 'query', description: 'Formation', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', description: 'Statut', schema: new OA\Schema(type: 'string', enum: ['planned', 'ongoing', 'completed', 'cancelled'])),
            new OA\Parameter(name: 'from', in: 'query', description: 'Début de période (start_at)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Fin de période (start_at)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'per_page', in: 'query', description: 'Résultats par page', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des sessions'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = TrainingSession::with(['course', 'trainer', 'agency'])
            ->withCount(['participants as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->when($request->course_id, fn ($q, $v) => $q->where('course_id', $v))
            ->when($request->agency_id, fn ($q, $v) => $q->where('agency_id', $v))
            ->when($request->status, fn ($q, $v) => $q->where('status', $v))
            ->when($request->from, fn ($q, $v) => $q->where('start_at', '>=', $v))
            ->when($request->to, fn ($q, $v) => $q->where('start_at', '<=', $v.' 23:59:59'));

        $this->scopeQuery($request, $query);

        return TrainingSessionResource::collection(
            $query->orderByDesc('start_at')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/training-sessions',
        summary: 'Créer une session de formation',
        tags: ['Académie — Sessions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Session créée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreTrainingSessionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['module_id'] = null;
        $this->resolveTrainer($data);

        // Une session appartient à une seule agence : celle de sa formation.
        // Seul un cours global (sans agence) prend l'agence de la requête.
        $courseAgencyId = Course::find($data['course_id'])?->agency_id;
        if ($courseAgencyId) {
            $data['agency_id'] = $courseAgencyId;
        }

        // Type de durée : déduit de la date de fin si non fourni ;
        // une session illimitée n'a pas de date de fin.
        if (! array_key_exists('duration_type', $data)) {
            $data['duration_type'] = ! empty($data['end_at']) ? 'limited' : 'unlimited';
        }
        if ($data['duration_type'] === 'unlimited') {
            $data['end_at'] = null;
        }

        // Création libre : une formation peut avoir plusieurs sessions dans la
        // même agence (y compris aux mêmes dates), seule la validation des
        // champs (StoreTrainingSessionRequest) s'applique.
        $created = TrainingSession::create($data);

        return (new TrainingSessionResource($created->load(['course', 'trainer', 'agency'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * N'importe quel compte interne peut animer une session. Le profil
     * formateur est résolu (créé à la volée pour le compte retenu) avant
     * l'enregistrement : `trainer_id` reste la source unique de vérité pour
     * les statistiques, la synchronisation inter-agences et le tableau de bord.
     *
     * @param  array<string, mixed>  $data
     */
    private function resolveTrainer(array &$data): void
    {
        $trainerUserId = $data['trainer_user_id'] ?? null;

        if (! empty($trainerUserId)) {
            $data['trainer_id'] = $this->trainerService->resolveTrainerId(null, (string) $trainerUserId);
        } elseif (array_key_exists('trainer_id', $data)) {
            $data['trainer_id'] = $this->trainerService->resolveTrainerId($data['trainer_id'], null);
        }

        unset($data['trainer_user_id']);
    }

    #[OA\Get(
        path: '/api/training-sessions/{trainingSession}',
        summary: 'Afficher une session de formation',
        tags: ['Académie — Sessions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'trainingSession', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la session'),
            new OA\Response(response: 404, description: 'Session non trouvée'),
        ]
    )]
    public function show(Request $request, TrainingSession $trainingSession): TrainingSessionResource
    {
        if ($request->user()?->role?->name === 'formateur') {
            $trainer = \App\Models\Trainer::forUser($request->user());
            abort_unless($trainer && in_array($trainingSession->id, $trainer->accessibleSessionIds(), true), 404);
        }

        return new TrainingSessionResource(
            $trainingSession
                ->load(['course', 'trainer', 'agency'])
                ->loadCount(['participants as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
        );
    }

    #[OA\Put(
        path: '/api/training-sessions/{trainingSession}',
        summary: 'Modifier une session de formation',
        tags: ['Académie — Sessions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'trainingSession', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Session modifiée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateTrainingSessionRequest $request, TrainingSession $trainingSession): TrainingSessionResource
    {
        $data = $request->validated();
        $data['module_id'] = null;
        $this->resolveTrainer($data);

        // L'agence reste celle de la formation (cours global : agence libre).
        $courseAgencyId = Course::find($data['course_id'] ?? $trainingSession->course_id)?->agency_id;
        if ($courseAgencyId) {
            $data['agency_id'] = $courseAgencyId;
        }

        if (($data['duration_type'] ?? null) === 'unlimited') {
            $data['end_at'] = null;
        }

        $trainingSession->forceFill(['module_id' => null]);
        $trainingSession->update($data);

        return new TrainingSessionResource($trainingSession->fresh()->load(['course', 'trainer', 'agency']));
    }

    #[OA\Delete(
        path: '/api/training-sessions/{trainingSession}',
        summary: 'Supprimer une session (soft delete)',
        tags: ['Académie — Sessions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'trainingSession', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Session supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(TrainingSession $trainingSession): JsonResponse
    {
        DB::transaction(function () use ($trainingSession) {
            Attendance::where('training_session_id', $trainingSession->id)->delete();
            \App\Models\SessionParticipant::where('training_session_id', $trainingSession->id)->delete();
            $trainingSession->delete();
        });

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/reports/training',
        summary: 'Rapport de formation : cours, sessions, inscriptions et recettes',
        tags: ['Académie — Sessions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Résumé par cours'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function report(Request $request): JsonResponse
    {
        $agencyIds = $this->scopeService->agencyIds($request->user());
        $from = $request->input('from');
        $to = $request->input('to');

        // Rapport ouvert depuis une agence/un département précis : uniquement les
        // formations de cette agence (pas les formations globales ni les autres
        // agences), à condition qu'elle soit dans le périmètre de l'utilisateur.
        $requestedAgencyId = $request->input('agency_id');
        if ($requestedAgencyId && $agencyIds !== null && ! in_array($requestedAgencyId, $agencyIds, true)) {
            $requestedAgencyId = null;
        }

        $courses = Course::withCount('sessions')
            ->with(['categories', 'agency'])
            ->when($request->filled('course_id'), fn ($q) => $q->where('id', $request->input('course_id')))
            ->when(
                $requestedAgencyId,
                fn ($q) => $q->where('agency_id', $requestedAgencyId),
                fn ($q) => $q->when($agencyIds !== null, function ($q) use ($agencyIds) {
                    return $q->where(fn ($c) => $c->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds));
                })
            )
            ->orderBy('name')
            ->get();

        // Cumul du taux de présence du périmètre (B22) : le front affiche la valeur
        // du serveur au lieu de recalculer présents / pointages de son côté.
        $attendancePresent = 0;
        $attendanceExpected = 0;

        $courses->each(function (Course $course) use ($from, $to, &$attendancePresent, &$attendanceExpected) {
            $sessions = $course->sessions()->withTrashed()
                ->when($from, fn ($q, $v) => $q->where('start_at', '>=', $v))
                ->when($to, fn ($q, $v) => $q->where('start_at', '<=', $v.' 23:59:59'))
                ->get();
            $activeEnrollments = FormationEnrollment::where('course_id', $course->id)
                ->active()
                ->with('invoice:id,total_amount,cancelled_at')
                ->when($from, fn ($q, $v) => $q->whereDate('enrolled_at', '>=', $v))
                ->when($to, fn ($q, $v) => $q->whereDate('enrolled_at', '<=', $v))
                ->get();

            $enrolled = $activeEnrollments->count();
            $completed = $activeEnrollments->where('status', 'completed')->count();

            // B22 : présents / attendus sur les séances passées, formule et
            // attendus uniques (AttendanceStats), comme les deux autres écrans.
            $attendance = AttendanceStats::compute($sessions);

            $attendancePresent += $attendance['present'];
            $attendanceExpected += $attendance['expected'];

            $revenue = \App\Services\AcademyReportService::enrollmentsRevenue($activeEnrollments, $course);

            $course->training_report = [
                'sessions_count' => $sessions->count(),
                'sessions_planned' => $sessions->where('status', 'planned')->count(),
                'sessions_completed' => $sessions->where('status', 'completed')->count(),
                'enrollments_total' => $enrolled,
                'enrollments_enrolled' => $enrolled,
                'enrollments_completed' => $completed,
                'attendance_count' => $attendance['present'],
                'attendance_expected' => $attendance['expected'],
                'attendance_marked' => $attendance['marked'],
                'attendance_rate' => $attendance['rate'],
                'potential_revenue' => round($revenue, 2),
            ];
        });

        $data = $courses->map(fn ($course) => [
            'id' => $course->id,
            'code' => $course->code,
            'name' => $course->name,
            'mode' => $course->mode,
            'category' => $course->categories->first()?->name,
            'agency' => $course->agency?->name ?: 'Global',
            'price' => (float) $course->price,
            'report' => $course->training_report,
        ]);

        return response()->json([
            'data' => $data,
            'summary' => [
                'courses' => $courses->count(),
                'sessions' => $courses->sum(fn ($c) => $c->training_report['sessions_count']),
                'enrollments' => $courses->sum(fn ($c) => $c->training_report['enrollments_total']),
                'potential_revenue' => round($courses->sum(fn ($c) => $c->training_report['potential_revenue']), 2),
                // null = aucune séance passée à attendre (« pas de donnée »).
                'attendance_expected' => $attendanceExpected,
                'attendance_rate' => $attendanceExpected > 0
                    ? min(100.0, round($attendancePresent / $attendanceExpected * 100, 1))
                    : null,
            ],
        ]);
    }

    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = TrainingSession::onlyTrashed()
            ->with(['course', 'trainer', 'agency'])
            ->withCount(['participants as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')]);

        $this->scopeQuery($request, $query);

        return TrainingSessionResource::collection(
            $query->orderByDesc('deleted_at')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    public function restore(string $id): TrainingSessionResource
    {
        $session = TrainingSession::onlyTrashed()->findOrFail($id);
        $session->restore();

        return new TrainingSessionResource($session->load(['course', 'trainer', 'agency']));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $session = TrainingSession::onlyTrashed()->findOrFail($id);
        $session->forceDelete();

        return response()->json(null, 204);
    }
}
