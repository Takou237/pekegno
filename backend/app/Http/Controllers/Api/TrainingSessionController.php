<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreTrainingSessionRequest;
use App\Http\Requests\Api\UpdateTrainingSessionRequest;
use App\Http\Resources\TrainingSessionResource;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\FormationEnrollment;
use App\Models\TrainingSession;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class TrainingSessionController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    /**
     * Réduit la requête au périmètre organisationnel : sessions des agences
     * autorisées (une session hérite de l'agence de son cours sinon de la sienne).
     */
    private function scopeQuery(Request $request, $query)
    {
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
            new OA\Parameter(name: 'course_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['planned', 'ongoing', 'completed', 'cancelled'])),
            new OA\Parameter(name: 'from', in: 'query', description: 'Début de période (start_at)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Fin de période (start_at)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des sessions'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = TrainingSession::with(['course', 'module', 'trainer', 'agency'])
            ->withCount(['formationEnrollments as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->when($request->course_id, fn ($q, $v) => $q->where('course_id', $v))
            ->when($request->module_id, fn ($q, $v) => $q->where('module_id', $v))
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

        if (empty($data['agency_id'])) {
            $data['agency_id'] = Course::find($data['course_id'])?->agency_id;
        }

        $session = TrainingSession::create($data);

        return (new TrainingSessionResource($session->load(['course', 'trainer', 'agency']) ))
            ->response()
            ->setStatusCode(201);
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
    public function show(TrainingSession $trainingSession): TrainingSessionResource
    {
        return new TrainingSessionResource(
            $trainingSession
                ->load(['course', 'module', 'trainer', 'agency'])
                ->loadCount(['formationEnrollments as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
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
        $trainingSession->update($request->validated());

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
        $trainingSession->delete();

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

        $courses = Course::withCount('sessions')
            ->with(['categories', 'agency'])
            ->when($request->filled('course_id'), fn ($q) => $q->where('id', $request->input('course_id')))
            ->when($agencyIds !== null, function ($q) use ($agencyIds) {
                return $q->where(fn ($c) => $c->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds));
            })
            ->orderBy('name')
            ->get();

        $courses->each(function (Course $course) {
            $sessions = $course->sessions()->withTrashed()->get();
            $sessionIds = $sessions->pluck('id');

            $activeEnrollments = FormationEnrollment::where('course_id', $course->id)
                ->whereNot('status', 'cancelled')
                ->get();

            $enrolled = $activeEnrollments->count();
            $completed = $activeEnrollments->where('status', 'completed')->count();
            $present = $sessionIds->isNotEmpty()
                ? Attendance::whereIn('training_session_id', $sessionIds)
                    ->where('status', Attendance::STATUS_PRESENT)
                    ->count()
                : 0;

            $revenue = $sessions->sum(function ($session) use ($enrolled, $course) {
                $price = $session->price !== null ? (float) $session->price : (float) ($course->price ?? 0);

                return $enrolled * $price;
            });

            $expectedPresences = $enrolled * $sessions->count();

            $course->training_report = [
                'sessions_count' => $sessions->count(),
                'sessions_planned' => $sessions->where('status', 'planned')->count(),
                'sessions_completed' => $sessions->where('status', 'completed')->count(),
                'enrollments_total' => $enrolled,
                'enrollments_enrolled' => $enrolled,
                'enrollments_completed' => $completed,
                'attendance_count' => $present,
                'attendance_rate' => $expectedPresences > 0 ? round($present / $expectedPresences * 100, 1) : 0,
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
            ],
        ]);
    }

    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = TrainingSession::onlyTrashed()
            ->with(['course', 'trainer', 'agency'])
            ->withCount(['formationEnrollments as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')]);

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