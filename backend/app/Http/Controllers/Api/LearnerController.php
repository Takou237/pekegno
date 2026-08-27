<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\TrainingSession;
use App\Models\User;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class LearnerController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    /**
     * Inscriptions de l'apprenant réduites au périmètre organisationnel
     * de l'appelant (une inscription hérite de l'agence de sa session).
     */
    private function scopedEnrollments(Request $request, User $learner)
    {
        $query = Enrollment::where('learner_user_id', $learner->id);
        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds !== null) {
            $query->whereHas('session', fn ($sq) => $sq->whereIn('agency_id', $agencyIds));
        }

        return $query;
    }

    /**
     * Sous-requête des inscriptions restreintes au périmètre organisationnel.
     */
    private function scopedEnrollmentQuery(?array $scopeAgencyIds)
    {
        $query = Enrollment::query();

        if ($scopeAgencyIds !== null) {
            $query->whereHas('session', fn ($sq) => $sq->whereIn('agency_id', $scopeAgencyIds));
        }

        return $query;
    }

    #[OA\Get(
        path: '/api/learners',
        summary: 'Lister les apprenants (clients) d\'une agence avec leur inscription la plus récente',
        tags: ['Académie — Apprenants'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Filtrer par agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', description: 'Filtrer par statut d\'inscription', schema: new OA\Schema(type: 'string', enum: ['enrolled', 'completed', 'cancelled'])),
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom/email/numéro client', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des apprenants'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $scopeAgencyIds = $this->scopeService->agencyIds($request->user());
        $agencyId = $request->input('agency_id');

        if ($agencyId && $scopeAgencyIds !== null) {
            $scopeAgencyIds = array_values(array_intersect($scopeAgencyIds, [$agencyId]));
        } elseif ($agencyId) {
            $scopeAgencyIds = [$agencyId];
        }

        $enrollQuery = fn () => $this->scopedEnrollmentQuery($scopeAgencyIds);

        $query = User::query()
            ->whereHas('role', fn ($q) => $q->where('name', 'client'));

        if ($scopeAgencyIds !== null) {
            $query->where(function ($q) use ($enrollQuery, $scopeAgencyIds) {
                $q->whereIn('registered_agency_id', $scopeAgencyIds)
                    ->orWhereIn('id', $enrollQuery()->select('learner_user_id'));
            });
        }

        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('client_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->whereIn('id', $enrollQuery()->where('status', $request->status)->select('learner_user_id'));
        }

        $learners = $query->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 15), 100));

        $learnerIds = collect($learners->items())->pluck('id');
        $enrollments = $enrollQuery()
            ->with(['session.course'])
            ->whereIn('learner_user_id', $learnerIds)
            ->get()
            ->groupBy('learner_user_id');

        $rows = collect($learners->items())->map(function (User $learner) use ($enrollments) {
            $list = $enrollments->get($learner->id, collect());
            $primary = $list->sortByDesc('created_at')->first();

            return [
                'id' => $learner->id,
                'learner' => [
                    'id' => $learner->id,
                    'first_name' => $learner->first_name,
                    'last_name' => $learner->last_name,
                    'email' => $learner->email,
                    'phone' => $learner->phone,
                    'client_number' => $learner->client_number,
                    'is_active' => $learner->is_active,
                ],
                'status' => $primary?->status,
                'enrollments_count' => $list->count(),
                'session' => $primary?->session ? [
                    'id' => $primary->session->id,
                    'start_at' => $primary->session->start_at?->toISOString(),
                    'course' => [
                        'id' => $primary->session->course?->id,
                        'name' => $primary->session->course?->name,
                    ],
                ] : null,
            ];
        });

        return response()->json([
            'data' => $rows->values(),
            'meta' => [
                'current_page' => $learners->currentPage(),
                'last_page' => $learners->lastPage(),
                'per_page' => $learners->perPage(),
                'total' => $learners->total(),
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/learners/{learner}/stats',
        summary: 'Statistiques d\'un apprenant : inscriptions, formations suivies, présences, investissement',
        tags: ['Académie — Apprenants'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'learner', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail et statistiques de l\'apprenant'),
            new OA\Response(response: 404, description: 'Apprenant non trouvé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function stats(Request $request, User $learner): JsonResponse
    {
        if ($learner->role?->name !== 'client') {
            return response()->json(['message' => 'Cet utilisateur n\'est pas un apprenant (client).'], 404);
        }

        $enrollments = $this->scopedEnrollments($request, $learner)
            ->with(['session.course', 'session.agency', 'session.trainer'])
            ->get();

        $sessions = $enrollments->pluck('session')->filter();

        $enrolled = $enrollments->where('status', 'enrolled')->count();
        $completed = $enrollments->where('status', 'completed')->count();
        $cancelled = $enrollments->where('status', 'cancelled')->count();
        $attended = $enrollments->where('attendance', true)->count();

        // Total investi : prix effectif des sessions non annulées.
        $invested = $sessions
            ->filter(fn ($session) => $session !== null)
            ->sum(function ($session) {
                return in_array($session->status, ['planned', 'ongoing', 'completed'], true)
                    ? (float) $session->effective_price
                    : 0.0;
            });

        // Heures de formation acquises : durée des cours des sessions terminées.
        $hoursCompleted = $sessions
            ->filter(fn ($session) => $session?->status === 'completed')
            ->sum(fn ($session) => (float) ($session->course?->duration_hours ?? 0));

        $upcoming = $enrollments
            ->filter(
                fn ($e) => $e->session !== null
                    && in_array($e->session->status, ['planned', 'ongoing'], true)
                    && $e->session->start_at >= now(),
            )
            ->sortBy(fn ($e) => $e->session->start_at)
            ->take(5)
            ->values();

        $recent = $enrollments
            ->sortByDesc('created_at')
            ->take(5)
            ->values();

        return response()->json([
            'learner' => [
                'id' => $learner->id,
                'first_name' => $learner->first_name,
                'last_name' => $learner->last_name,
                'email' => $learner->email,
                'phone' => $learner->phone,
                'client_number' => $learner->client_number,
                'is_active' => $learner->is_active,
                'created_at' => $learner->created_at?->toISOString(),
            ],
            'stats' => [
                'enrollments_total' => $enrollments->count(),
                'enrollments_by_status' => [
                    'enrolled' => $enrolled,
                    'completed' => $completed,
                    'cancelled' => $cancelled,
                ],
                'courses_unique' => $sessions->pluck('course_id')->unique()->count(),
                'trainers_unique' => $sessions->pluck('trainer_id')->filter()->unique()->count(),
                'sessions_upcoming' => $upcoming->count(),
                'attendance_count' => $attended,
                'completion_rate' => $enrollments->count() > 0
                    ? round($completed / $enrollments->count() * 100, 1)
                    : 0.0,
                'total_invested' => round($invested, 2),
                'hours_completed' => round($hoursCompleted, 1),
            ],
            'upcoming_sessions' => $upcoming->map(fn ($e) => $this->formatSession($e))->values(),
            'recent_enrollments' => $recent->map(fn ($e) => $this->formatSession($e))->values(),
        ]);
    }

    private function formatSession(Enrollment $enrollment): array
    {
        $session = $enrollment->session;

        return [
            'id' => $enrollment->id,
            'course' => [
                'id' => $session?->course?->id,
                'name' => $session?->course?->name,
                'code' => $session?->course?->code,
            ],
            'trainer' => $session?->trainer
                ? trim(($session->trainer->first_name ?? '').' '.($session->trainer->last_name ?? ''))
                : null,
            'start_at' => $session?->start_at?->toISOString(),
            'location' => $session?->location,
            'status' => $enrollment->status,
            'attendance' => $enrollment->attendance,
        ];
    }
}
