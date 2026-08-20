<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCourseRequest;
use App\Http\Requests\Api\UpdateCourseRequest;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Models\TrainingSession;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class CourseController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    /**
     * Réduit la requête au périmètre organisationnel : cours globaux
     * (agency_id null) + cours des agences autorisées.
     */
    private function scopeQuery(Request $request, $query)
    {
        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds === null) {
            return $query;
        }

        return $query->where(function ($q) use ($agencyIds) {
            $q->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds);
        });
    }

    #[OA\Get(
        path: '/api/courses',
        summary: 'Lister les cours avec pagination, recherche et filtres',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom, code ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'mode', in: 'query', schema: new OA\Schema(type: 'string', enum: ['online', 'in_person', 'mixed'])),
            new OA\Parameter(name: 'category_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Disponibilité : cours de l\'agence + cours globaux', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'price', 'created_at'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des cours'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Course::with(['category', 'agency'])
            ->withCount('sessions')
            ->search($request->input('search'))
            ->when($request->mode, fn ($q, $v) => $q->where('mode', $v))
            ->when($request->category_id, fn ($q, $v) => $q->where('category_id', $v))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->agency_id, fn ($q, $v) => $q->availableIn($v));

        $this->scopeQuery($request, $query);

        $sortBy = in_array($request->input('sort_by'), ['name', 'price', 'duration_hours', 'created_at'], true)
            ? $request->input('sort_by')
            : 'name';
        $sortOrder = $request->input('sort_order', 'asc') === 'desc' ? 'desc' : 'asc';

        return CourseResource::collection(
            $query->orderBy($sortBy, $sortOrder)
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/courses',
        summary: 'Créer un cours (code auto-généré si absent)',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Cours créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreCourseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['code'] = $data['code'] ?? Course::generateCode();

        $course = Course::create($data);

        return (new CourseResource($course->load(['category', 'agency'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/courses/{course}',
        summary: 'Afficher un cours',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du cours'),
            new OA\Response(response: 404, description: 'Cours non trouvé'),
        ]
    )]
    public function show(Course $course): CourseResource
    {
        return new CourseResource($course->load(['category', 'agency', 'sessions']));
    }

    #[OA\Put(
        path: '/api/courses/{course}',
        summary: 'Modifier un cours',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Cours modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateCourseRequest $request, Course $course): CourseResource
    {
        $course->update($request->validated());

        return new CourseResource($course->fresh()->load(['category', 'agency']));
    }

    #[OA\Delete(
        path: '/api/courses/{course}',
        summary: 'Supprimer un cours (soft delete)',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Cours supprimé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Course $course): JsonResponse
    {
        $course->delete();

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/courses/trash',
        summary: 'Lister les cours supprimés',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des cours supprimés'),
        ]
    )]
    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Course::onlyTrashed()
            ->with(['category', 'agency'])
            ->search($request->input('search'));

        $this->scopeQuery($request, $query);

        return CourseResource::collection(
            $query->orderByDesc('deleted_at')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    public function restore(string $id): CourseResource
    {
        $course = Course::onlyTrashed()->findOrFail($id);
        $course->restore();

        return new CourseResource($course->load(['category', 'agency']));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $course = Course::onlyTrashed()->findOrFail($id);
        $course->forceDelete();

        return response()->json(null, 204);
    }
}