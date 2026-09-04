<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SessionParticipant;
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
    private function scopedSessionParticipants(Request $request, User $learner)
    {
        $query = SessionParticipant::whereHas('formationEnrollment', fn ($q) => $q->where('learner_user_id', $learner->id));
        $agencyIds = $this->scopeService->agencyIds($request->user());

        $this->applyAgencyScope($query, $agencyIds);

        return $query;
    }

    /**
     * Sous-requête des inscriptions restreintes au périmètre organisationnel.
     */
    private function scopedSessionParticipantQuery(?array $scopeAgencyIds)
    {
        $query = SessionParticipant::query();

        $this->applyAgencyScope($query, $scopeAgencyIds);

        return $query;
    }

    /**
     * Restreint les participants aux sessions des agences autorisées
     * (une session hérite de l'agence de son cours si elle n'en a pas d'explicite).
     */
    private function applyAgencyScope($query, ?array $agencyIds): void
    {
        if ($agencyIds === null) {
            return;
        }

        $query->whereHas('session', function ($sq) use ($agencyIds) {
            $sq->where(function ($w) use ($agencyIds) {
                $w->whereIn('agency_id', $agencyIds)
                    ->orWhereHas('course', fn ($c) => $c->whereIn('agency_id', $agencyIds)->orWhereNull('agency_id'));
            });
        });
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

        $participantQuery = fn () => $this->scopedSessionParticipantQuery($scopeAgencyIds);
        $formationQuery = fn () => \App\Models\FormationEnrollment::query()
            ->when(
                $scopeAgencyIds !== null,
                fn ($q) => $q->whereHas('course', fn ($cq) => $cq->whereIn('agency_id', $scopeAgencyIds)->orWhereNull('agency_id')),
            );

        $query = User::query()
            ->whereHas('role', fn ($q) => $q->where('name', 'client'));

        if ($scopeAgencyIds !== null) {
            $learnerIdsFromParticipants = $participantQuery()
                ->join('formation_enrollments', 'formation_enrollments.id', '=', 'session_participants.formation_enrollment_id')
                ->select('formation_enrollments.learner_user_id');

            $query->where(function ($q) use ($learnerIdsFromParticipants, $formationQuery, $scopeAgencyIds) {
                $q->whereIn('registered_agency_id', $scopeAgencyIds)
                    ->orWhereIn('id', $learnerIdsFromParticipants)
                    ->orWhereIn('id', $formationQuery()->select('learner_user_id'));
            });
        }

        if ($request->search) {
            // Recherche multi-termes : « rap bro » doit matcher prénom + nom.
            $terms = preg_split('/\s+/', trim($request->search));
            $query->where(function ($q) use ($terms) {
                foreach ($terms as $term) {
                    $q->where(function ($inner) use ($term) {
                        $inner->where('first_name', 'like', "%{$term}%")
                            ->orWhere('last_name', 'like', "%{$term}%")
                            ->orWhere('email', 'like', "%{$term}%")
                            ->orWhere('client_number', 'like', "%{$term}%");
                    });
                }
            });
        }

        if ($request->filled('status')) {
            $query->whereIn('id', \App\Models\FormationEnrollment::query()
                ->when(
                    $scopeAgencyIds !== null,
                    fn ($q) => $q->whereHas('course', fn ($cq) => $cq->whereIn('agency_id', $scopeAgencyIds)->orWhereNull('agency_id')),
                )
                ->where('status', $request->status)
                ->select('learner_user_id'));
        }

        $learners = $query->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 15), 100));

        $learnerIds = collect($learners->items())->pluck('id');

        $sessionParticipants = $participantQuery()
            ->with(['session.course', 'formationEnrollment'])
            ->whereHas('formationEnrollment', fn($q) => $q->whereIn('learner_user_id', $learnerIds))
            ->get()
            ->groupBy(fn($p) => $p->formationEnrollment?->learner_user_id ?? $p->id);

        $formationEnrollments = $formationQuery()
            ->with(['course'])
            ->whereIn('learner_user_id', $learnerIds)
            ->get()
            ->groupBy('learner_user_id');

        $rows = collect($learners->items())->map(function (User $learner) use ($sessionParticipants, $formationEnrollments) {
            $sessions = $sessionParticipants->get($learner->id, collect());
            $formations = $formationEnrollments->get($learner->id, collect());

            $primaryFormation = $formations->sortByDesc('enrolled_at')->first();
            $primarySession = $sessions->sortByDesc('created_at')->first();

            if ($primaryFormation) {
                $primaryStatus = $primaryFormation->status;
                $course = $primaryFormation->course;
                $primary = [
                    'source' => 'formation',
                    'course_id' => $course?->id,
                    'course_name' => $course?->name,
                    'course_code' => $course?->code,
                    'status' => $primaryStatus,
                    'date' => $primaryFormation->enrolled_at?->toISOString(),
                ];
            } else {
                $primaryStatus = $primarySession?->status;
                $primary = [
                    'source' => 'session',
                    'course_id' => $primarySession?->session?->course?->id,
                    'course_name' => $primarySession?->session?->course?->name,
                    'course_code' => $primarySession?->session?->course?->code,
                    'status' => $primaryStatus,
                    'date' => $primarySession?->session?->start_at?->toISOString(),
                ];
            }

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
                'primary' => $primary,
                'status' => $primaryStatus,
                'enrollments_count' => $sessionParticipants->get($learner->id, collect())->count()
                    + $formationEnrollments->get($learner->id, collect())->count(),
                'session' => $primarySession?->session ? [
                    'id' => $primarySession->session->id,
                    'start_at' => $primarySession->session->start_at?->toISOString(),
                    'course' => [
                        'id' => $primarySession->session->course?->id,
                        'name' => $primarySession->session->course?->name,
                    ],
                ] : null,
                'formations' => $formations->map(fn ($f) => [
                    'id' => $f->id,
                    'course_id' => $f->course_id,
                    'course_name' => $f->course?->name,
                    'course_code' => $f->course?->code,
                    'status' => $f->status,
                    'enrolled_at' => $f->enrolled_at?->toISOString(),
                ])->values(),
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

        $participants = $this->scopedSessionParticipants($request, $learner)
            ->with(['session.course', 'session.agency', 'session.trainer', 'formationEnrollment'])
            ->get();

        $enrolled = $participants->where('status', 'enrolled')->count();
        $cancelled = $participants->where('status', 'cancelled')->count();
        $completed = $participants->filter(fn ($p) => $p->formationEnrollment?->status === 'completed')->count();
        $attended = \App\Models\Attendance::where('learner_user_id', $learner->id)
            ->where('status', 'present')
            ->count();

        // Total investi : prix effectif des sessions non annulées.
        $sessions = $participants->reject(fn ($p) => $p->status === 'cancelled')
            ->pluck('session')
            ->filter();

        $invested = $sessions
            ->sum(function ($session) {
                return in_array($session->status, ['planned', 'ongoing', 'completed'], true)
                    ? (float) $session->effective_price
                    : 0.0;
            });

        // Heures de formation acquises : durée des cours des sessions terminées.
        $hoursCompleted = $sessions
            ->filter(fn ($session) => $session?->status === 'completed')
            ->sum(fn ($session) => (float) ($session->course?->duration_hours ?? 0));

        $upcoming = $participants
            ->filter(
                fn ($p) => $p->status !== 'cancelled'
                    && $p->session !== null
                    && in_array($p->session->status, ['planned', 'ongoing'], true)
                    && $p->session->start_at >= now(),
            )
            ->sortBy(fn ($p) => $p->session->start_at)
            ->take(5)
            ->values();

        $recent = $participants
            ->reject(fn ($p) => $p->status === 'cancelled')
            ->sortByDesc('created_at')
            ->take(5)
            ->values();

        $attendedSessionIds = \App\Models\Attendance::where('learner_user_id', $learner->id)
            ->where('status', 'present')
            ->pluck('training_session_id')
            ->unique()
            ->flip();

        $coursesProgress = $participants
            ->reject(fn ($p) => $p->status === 'cancelled' || $p->session === null || $p->session->course === null)
            ->groupBy(fn ($p) => $p->session->course_id)
            ->map(function ($group) use ($attendedSessionIds) {
                $course = $group->first()->session->course;
                $total = $group->count();
                $completed = $group->filter(function ($p) use ($attendedSessionIds) {
                    return isset($attendedSessionIds[$p->training_session_id]);
                })->count();
                return [
                    'course_id' => $course->id,
                    'course_name' => $course->name,
                    'course_code' => $course->code,
                    'total_sessions' => $total,
                    'completed_sessions' => $completed,
                    'progress_percent' => $total > 0 ? round($completed / $total * 100, 1) : 0.0,
                ];
            })
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
                'enrollments_total' => $participants->count(),
                'enrollments_by_status' => [
                    'enrolled' => $enrolled,
                    'completed' => $completed,
                    'cancelled' => $cancelled,
                ],
                'courses_unique' => $sessions->pluck('course_id')->unique()->count(),
                'trainers_unique' => $sessions->pluck('trainer_id')->filter()->unique()->count(),
                'sessions_upcoming' => $upcoming->count(),
                'attendance_count' => $attended,
                'completion_rate' => $participants->count() > 0
                    ? round($completed / $participants->count() * 100, 1)
                    : 0.0,
                'total_invested' => round($invested, 2),
                'hours_completed' => round($hoursCompleted, 1),
                'courses_progress' => $coursesProgress,
            ],
            'upcoming_sessions' => $upcoming->map(fn ($p) => $this->formatSession($p))->values(),
            'recent_enrollments' => $recent->map(fn ($p) => $this->formatSession($p))->values(),
        ]);
    }

    private function formatSession(\App\Models\SessionParticipant $participant): array
    {
        $session = $participant->session;
        $attendance = $participant->formationEnrollment
            ? \App\Models\Attendance::where('training_session_id', $session->id)
                ->where('learner_user_id', $participant->formationEnrollment->learner_user_id)
                ->first()
            : null;

        return [
            'id' => $participant->id,
            'course' => [
                'id' => $session?->course?->id,
                'name' => $session?->course?->name,
                'code' => $session?->course?->code,
            ],
            'trainer' => $session?->trainer
                ? trim(($session->trainer->first_name ?? '').' '.($session->trainer->last_name ?? ''))
                : null,
            'start_at' => $session?->start_at?->toISOString(),
            'status' => $participant->formationEnrollment?->status ?? $participant->status,
            'attendance' => $attendance?->status === 'present',
        ];
    }
}
