<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCourseCategoryRequest;
use App\Http\Requests\Api\UpdateCourseCategoryRequest;
use App\Http\Resources\CourseCategoryResource;
use App\Models\CourseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class CourseCategoryController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(CourseCategory::class, 'course_category');
    }

    #[OA\Get(
        path: '/api/course-categories',
        summary: 'Lister les catégories de formations avec pagination, recherche et tri',
        tags: ['Catégories de formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', description: 'Nombre de résultats par page', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'created_at'], default: 'name')),
            new OA\Parameter(name: 'sort_order', in: 'query', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des catégories de formations'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CourseCategory::withCount('courses')
            ->search($request->input('search'));

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSorts = ['name', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        return CourseCategoryResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/course-categories',
        summary: 'Créer une catégorie de formation',
        tags: ['Catégories de formations'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Informatique'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'color', type: 'string', example: '#3B82F6'),
                    new OA\Property(property: 'icon', type: 'string', example: 'book'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Catégorie de formation créée', content: new OA\JsonContent(ref: '#/components/schemas/CourseCategory')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreCourseCategoryRequest $request): JsonResponse
    {
        $category = CourseCategory::create($request->validated());

        return (new CourseCategoryResource($category))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/course-categories/{course_category}',
        summary: 'Afficher une catégorie de formation',
        tags: ['Catégories de formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course_category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la catégorie de formation', content: new OA\JsonContent(ref: '#/components/schemas/CourseCategory')),
            new OA\Response(response: 404, description: 'Catégorie non trouvée'),
        ]
    )]
    public function show(CourseCategory $courseCategory): CourseCategoryResource
    {
        return new CourseCategoryResource($courseCategory->loadCount('courses'));
    }

    #[OA\Put(
        path: '/api/course-categories/{course_category}',
        summary: 'Modifier une catégorie de formation',
        tags: ['Catégories de formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course_category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'color', type: 'string'),
                    new OA\Property(property: 'icon', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Catégorie de formation modifiée', content: new OA\JsonContent(ref: '#/components/schemas/CourseCategory')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Catégorie non trouvée'),
        ]
    )]
    public function update(UpdateCourseCategoryRequest $request, CourseCategory $courseCategory): CourseCategoryResource
    {
        $courseCategory->update($request->validated());

        return new CourseCategoryResource($courseCategory->fresh()->loadCount('courses'));
    }

    #[OA\Delete(
        path: '/api/course-categories/{course_category}',
        summary: 'Supprimer une catégorie de formation',
        tags: ['Catégories de formations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course_category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Catégorie de formation supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(CourseCategory $courseCategory): JsonResponse
    {
        $courseCategory->delete();

        return response()->json(null, 204);
    }
}