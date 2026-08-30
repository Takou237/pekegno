<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreTrainerRequest;
use App\Http\Requests\Api\UpdateTrainerRequest;
use App\Models\Attendance;
use App\Models\CommissionEntry;
use App\Models\CommissionPayment;
use App\Models\CourseModule;
use App\Models\FormationEnrollment;
use App\Models\SellerProfile;
use App\Models\Trainer;
use App\Models\User;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

/**
 * Les formateurs sont des profils autonomes : ils n'ont pas besoin d'un
 * compte utilisateur pour être créés et assignés à des sessions.
 */
class TrainerController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    private function scopeQuery(Request $request, $query)
    {
        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds === null) {
            return $query;
        }

        return $query->whereIn('agency_id', $agencyIds);
    }

    /**
     * Crée automatiquement un profil formateur pour chaque utilisateur ayant
     * le rôle « formateur » affecté aux agences du périmètre : ils apparaissent
     * ainsi dans la liste avec leur compte lié (has_account).
     *
     * Public : réutilisé par la liste Employés (CommercialController) pour que
     * les formateurs liés à un compte ressortent aussi dans l'annuaire RH.
     */
    public function syncUserTrainers(Request $request, ?string $agencyId): void
    {
        $formateurRoleId = DB::table('roles')->where('name', 'formateur')->value('id');

        if (! $formateurRoleId) {
            return;
        }

        // Complète l'agence des profils liés à un compte mais sans agence
        // (ex : profils créés par le backfill de migration).
        DB::statement(<<<'SQL'
            UPDATE trainers t
            SET agency_id = ua.agency_id
            FROM user_assignments ua
            WHERE t.user_id = ua.user_id AND t.agency_id IS NULL
        SQL);

        $usersQuery = DB::table('users')
            ->join('user_assignments', 'user_assignments.user_id', '=', 'users.id')
            ->where('users.role_id', $formateurRoleId)
            ->whereNotIn('users.id', function ($q) {
                $q->select('user_id')->from('trainers')->whereNotNull('user_id');
            })
            ->select('users.id', 'users.first_name', 'users.last_name', 'users.email', 'users.phone', 'users.is_active', 'user_assignments.agency_id');

        if ($agencyId) {
            $usersQuery->where('user_assignments.agency_id', $agencyId);
        } else {
            $agencyIds = $this->scopeService->agencyIds($request->user());

            if ($agencyIds !== null) {
                $usersQuery->whereIn('user_assignments.agency_id', $agencyIds);
            }
        }

        foreach ($usersQuery->get() as $user) {
            $now = now();

            DB::table('trainers')->insert([
                'id' => (string) Str::uuid(),
                'agency_id' => $user->agency_id,
                'user_id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_active' => $user->is_active,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    #[OA\Get(
        path: '/api/trainers/available-users',
        summary: 'Utilisateurs formateurs n\'ayant pas encore de profil formateur',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        responses: [new OA\Response(response: 200, description: 'Liste des utilisateurs liables')]
    )]
    public function availableUsers(Request $request): JsonResponse
    {
        $linkedIds = DB::table('trainers')
            ->whereNotNull('user_id')
            ->pluck('user_id');

        $query = User::query()
            ->whereHas('role', fn ($q) => $q->where('name', 'formateur'))
            ->when($linkedIds->isNotEmpty(), fn ($q) => $q->whereNotIn('id', $linkedIds))
            ->when($request->agency_id, fn ($q, $v) => $q->whereHas(
                'assignments',
                fn ($aq) => $aq->where('agency_id', $v),
            ))
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'email', 'is_active']);

        return response()->json($query);
    }

    #[OA\Post(
        path: '/api/trainers/{trainer}/link-user',
        summary: 'Lier un compte utilisateur (rôle formateur) à un profil formateur',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Compte lié'),
            new OA\Response(response: 422, description: 'Utilisateur invalide ou déjà lié'),
        ]
    )]
    public function linkUser(Request $request, Trainer $trainer): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
        ]);

        $user = User::findOrFail($validated['user_id']);

        if ($user->role?->name !== 'formateur') {
            return response()->json([
                'message' => 'L\'utilisateur doit avoir le rôle « formateur ».',
            ], 422);
        }

        $alreadyLinked = Trainer::where('user_id', $user->id)->whereKeyNot($trainer->id)->exists();

        if ($alreadyLinked) {
            return response()->json([
                'message' => 'Cet utilisateur est déjà lié à un autre profil formateur.',
            ], 422);
        }

        $trainer->update([
            'user_id' => $user->id,
            'first_name' => $trainer->first_name ?? $user->first_name,
            'last_name' => $trainer->last_name ?? $user->last_name,
            'email' => $trainer->email ?? $user->email,
            'phone' => $trainer->phone ?? $user->phone,
        ]);

        return response()->json([
            'data' => new \App\Http\Resources\TrainerResource($trainer->fresh()),
        ]);
    }

    #[OA\Get(
        path: '/api/trainers',
        summary: 'Lister les formateurs (profils, avec ou sans compte)',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'is_active', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [new OA\Response(response: 200, description: 'Liste paginée des formateurs')]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        // Les users « formateur » du périmètre obtiennent leur profil à la volée.
        $this->syncUserTrainers($request, $request->agency_id);

        $query = Trainer::query()
            ->withCount('sessions')
            ->when($request->agency_id, fn ($q, $v) => $q->where('agency_id', $v))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->search, function ($q, $search) {
                $terms = preg_split('/\s+/', trim($search));

                foreach ($terms as $term) {
                    $q->where(function ($sq) use ($term) {
                        $sq->where('first_name', 'ilike', "%{$term}%")
                            ->orWhere('last_name', 'ilike', "%{$term}%")
                            ->orWhere('email', 'ilike', "%{$term}%");
                    });
                }
            });

        $this->scopeQuery($request, $query);

        return \App\Http\Resources\TrainerResource::collection(
            $query->orderBy('first_name')->orderBy('last_name')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/trainers',
        summary: 'Créer un profil formateur (sans compte utilisateur requis)',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Formateur créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreTrainerRequest $request): JsonResponse
    {
        $trainer = Trainer::create($request->validated());

        return response()->json([
            'data' => new \App\Http\Resources\TrainerResource($trainer),
        ], 201);
    }

    #[OA\Get(
        path: '/api/trainers/{trainer}',
        summary: 'Afficher un formateur',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        responses: [new OA\Response(response: 200, description: 'Détail du formateur')]
    )]
    public function show(Request $request, Trainer $trainer): JsonResponse
    {
        $trainer->loadCount(['sessions' => fn ($q) => $this->scopedSessions($request, $trainer)]);

        return response()->json([
            'data' => new \App\Http\Resources\TrainerResource($trainer),
        ]);
    }

    #[OA\Put(
        path: '/api/trainers/{trainer}',
        summary: 'Mettre à jour un formateur',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        responses: [new OA\Response(response: 200, description: 'Formateur mis à jour')]
    )]
    public function update(UpdateTrainerRequest $request, Trainer $trainer): JsonResponse
    {
        $trainer->update($request->validated());

        return response()->json([
            'data' => new \App\Http\Resources\TrainerResource($trainer->fresh()),
        ]);
    }

    #[OA\Delete(
        path: '/api/trainers/{trainer}',
        summary: 'Supprimer un formateur (soft delete)',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        responses: [new OA\Response(response: 204, description: 'Formateur supprimé')]
    )]
    public function destroy(Trainer $trainer): JsonResponse
    {
        $trainer->delete();

        return response()->json(null, 204);
    }

    /**
     * Sessions du formateur réduites au périmètre organisationnel de l'appelant.
     */
    private function scopedSessions(Request $request, Trainer $trainer)
    {
        $query = $trainer->sessions();
        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds !== null) {
            $query->whereIn('agency_id', $agencyIds);
        }

        return $query;
    }

    #[OA\Get(
        path: '/api/trainers/{trainer}/stats',
        summary: 'Statistiques d\'un formateur : sessions, inscriptions, apprenants, revenus',
        tags: ['Académie — Formateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'trainer', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail et statistiques du formateur'),
            new OA\Response(response: 404, description: 'Formateur non trouvé'),
        ]
    )]
    public function stats(Request $request, Trainer $trainer): JsonResponse
    {
        $sessions = $this->scopedSessions($request, $trainer)->with('course')->get();

        $sessionIds = $sessions->pluck('id');
        $courseIds = $sessions->pluck('course_id')->filter()->unique()->values();

        $enrollments = $courseIds->isNotEmpty()
            ? FormationEnrollment::whereIn('course_id', $courseIds)->get()
            : collect();

        $notCancelled = fn ($enrollment) => $enrollment->status !== 'cancelled';

        $enrolled = $enrollments->filter($notCancelled)->count();
        $completed = $enrollments->where('status', 'completed')->count();
        $cancelled = $enrollments->where('status', 'cancelled')->count();
        $present = $sessionIds->isNotEmpty()
            ? Attendance::whereIn('training_session_id', $sessionIds)
                ->where('status', Attendance::STATUS_PRESENT)
                ->count()
            : 0;

        // Revenus potentiels : inscrits (non annulés) au cours × prix effectif de chaque session.
        $revenue = $sessions->sum(function ($session) use ($enrollments, $notCancelled) {
            $count = $enrollments
                ->where('course_id', $session->course_id)
                ->filter($notCancelled)
                ->count();

            return $count * $session->effective_price;
        });

        // Présences attendues : un apprenant inscrit est attendu à chaque session de son cours.
        $expectedPresences = $sessions->sum(fn ($session) => $enrollments
            ->where('course_id', $session->course_id)
            ->filter($notCancelled)
            ->count());

        // Heures enseignées : durée du cours des sessions terminées ou en cours.
        $hoursTaught = $sessions
            ->whereIn('status', ['completed', 'ongoing'])
            ->sum(fn ($session) => (float) ($session->course?->duration_hours ?? 0));

        $byStatus = [
            'planned' => $sessions->where('status', 'planned')->count(),
            'ongoing' => $sessions->where('status', 'ongoing')->count(),
            'completed' => $sessions->where('status', 'completed')->count(),
            'cancelled' => $sessions->where('status', 'cancelled')->count(),
        ];

        $recentSessions = $this->scopedSessions($request, $trainer)
            ->with(['course', 'agency'])
            ->withCount(['formationEnrollments as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->orderByDesc('start_at')
            ->limit(5)
            ->get();

        $upcomingSessions = $this->scopedSessions($request, $trainer)
            ->with(['course', 'agency'])
            ->withCount(['formationEnrollments as enrollments_count' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->whereIn('status', ['planned', 'ongoing'])
            ->where('start_at', '>=', now())
            ->orderBy('start_at')
            ->limit(5)
            ->get();

        $assignedModules = CourseModule::where('trainer_id', $trainer->id)
            ->with('course:id,name,code')
            ->orderBy('course_id')
            ->orderBy('order_index')
            ->get();

        // Ventes réalisées par le formateur en qualité de vendeur de formations.
        $salesEnrollments = FormationEnrollment::query()
            ->where('seller_trainer_id', $trainer->id)
            ->whereNot('status', 'cancelled')
            ->with(['course:id,name,code', 'invoice:id,total_amount,status,cancelled_at', 'learner:id,first_name,last_name,email'])
            ->get();

        $paidSales = $salesEnrollments->filter(
            fn ($e) => $e->invoice && $e->invoice->status === 'paid' && $e->invoice->cancelled_at === null
        );

        // Commissions via les profils vendeur liés au compte du formateur.
        $profileIds = SellerProfile::query()
            ->where('user_id', $trainer->user_id)
            ->pluck('id');

        $commissionsEarned = (float) CommissionEntry::query()
            ->whereNot('status', CommissionEntry::STATUS_CANCELLED)
            ->whereIn('seller_profile_id', $profileIds)
            ->sum('amount');

        $commissionsPaid = (float) CommissionPayment::query()
            ->where('rule', 'commission_payment')
            ->whereIn('seller_profile_id', $profileIds)
            ->sum('amount');

        return response()->json([
            'trainer' => [
                'id' => $trainer->id,
                'first_name' => $trainer->first_name,
                'last_name' => $trainer->last_name,
                'email' => $trainer->email,
                'phone' => $trainer->phone,
                'bio' => $trainer->bio,
                'is_active' => $trainer->is_active,
                'has_account' => $trainer->user_id !== null,
                'created_at' => $trainer->created_at?->toISOString(),
            ],
            'stats' => [
                'sessions_total' => $sessions->count(),
                'sessions_by_status' => $byStatus,
                'sessions_upcoming' => $upcomingSessions->count(),
                'enrollments_total' => $enrollments->count(),
                'enrollments_enrolled' => $enrolled,
                'enrollments_completed' => $completed,
                'enrollments_cancelled' => $cancelled,
                'learners_unique' => $enrollments->pluck('learner_user_id')->unique()->count(),
                'attendance_count' => $present,
                'attendance_rate' => $expectedPresences > 0
                    ? round($present / $expectedPresences * 100, 1)
                    : 0.0,
                'completion_rate' => $enrolled > 0
                    ? round($completed / $enrolled * 100, 1)
                    : 0.0,
                'potential_revenue' => round($revenue, 2),
                'hours_taught' => round($hoursTaught, 1),
                'sales_count' => $paidSales->count(),
                'sales_turnover' => round($paidSales->sum(fn ($e) => (float) ($e->invoice?->total_amount ?? 0)), 2),
                'commissions_earned' => round($commissionsEarned, 2),
                'commissions_paid' => round($commissionsPaid, 2),
                'commissions_balance' => round($commissionsEarned - $commissionsPaid, 2),
            ],
            'recent_sales' => $salesEnrollments
                ->sortByDesc('updated_at')
                ->take(5)
                ->values()
                ->map(fn ($e) => [
                    'id' => $e->id,
                    'course' => $e->course ? ['id' => $e->course->id, 'name' => $e->course->name, 'code' => $e->course->code] : null,
                    'learner' => $e->learner ? [
                        'id' => $e->learner->id,
                        'first_name' => $e->learner->first_name,
                        'last_name' => $e->learner->last_name,
                    ] : null,
                    'date' => $e->enrolled_at?->toISOString(),
                    'amount' => (float) ($e->invoice?->total_amount ?? 0),
                ])
                ->all(),
            'recent_sessions' => $recentSessions->map(fn ($s) => $this->formatSession($s))->values(),
            'upcoming_sessions' => $upcomingSessions->map(fn ($s) => $this->formatSession($s))->values(),
            'assigned_modules' => $assignedModules->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'order_index' => $m->order_index,
                'course' => $m->course ? ['id' => $m->course->id, 'name' => $m->course->name, 'code' => $m->course->code] : null,
            ])->values(),
        ]);
    }

    private function formatSession(\App\Models\TrainingSession $session): array
    {
        return [
            'id' => $session->id,
            'course' => [
                'id' => $session->course?->id,
                'name' => $session->course?->name,
                'code' => $session->course?->code,
            ],
            'agency' => [
                'id' => $session->agency?->id,
                'name' => $session->agency?->name,
            ],
            'start_at' => $session->start_at?->toISOString(),
            'status' => $session->status,
            'enrollments_count' => $session->enrollments_count ?? $session->enrollments()->count(),
        ];
    }
}
