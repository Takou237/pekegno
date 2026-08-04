<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCategoryRequest;
use App\Http\Requests\Api\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class CategoryController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Category::class, 'category');
    }

    #[OA\Get(
        path: '/api/categories',
        summary: 'Lister les catégories avec pagination, recherche et tri',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', description: 'Nombre de résultats par page', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'created_at'], default: 'name')),
            new OA\Parameter(name: 'sort_order', in: 'query', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des catégories'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Category::withCount('services')
            ->search($request->input('search'));

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSorts = ['name', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        return CategoryResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/categories',
        summary: 'Créer une catégorie',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Conseil'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'color', type: 'string', example: '#3B82F6'),
                    new OA\Property(property: 'icon', type: 'string', example: 'book'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Catégorie créée', content: new OA\JsonContent(ref: '#/components/schemas/Category')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = Category::create($request->validated());

        return (new CategoryResource($category))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/categories/{category}',
        summary: 'Afficher une catégorie',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la catégorie', content: new OA\JsonContent(ref: '#/components/schemas/Category')),
            new OA\Response(response: 404, description: 'Catégorie non trouvée'),
        ]
    )]
    public function show(Category $category): CategoryResource
    {
        return new CategoryResource($category->loadCount('services'));
    }

    #[OA\Put(
        path: '/api/categories/{category}',
        summary: 'Modifier une catégorie',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
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
            new OA\Response(response: 200, description: 'Catégorie modifiée', content: new OA\JsonContent(ref: '#/components/schemas/Category')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Catégorie non trouvée'),
        ]
    )]
    public function update(UpdateCategoryRequest $request, Category $category): CategoryResource
    {
        $category->update($request->validated());

        return new CategoryResource($category->fresh()->loadCount('services'));
    }

    #[OA\Delete(
        path: '/api/categories/{category}',
        summary: 'Supprimer une catégorie (soft delete)',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Catégorie supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Category $category): JsonResponse
    {
        $category->delete();

        return response()->json(null, 204);
    }

    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Category::onlyTrashed()
            ->search($request->input('search'))
            ->orderBy('deleted_at', 'desc');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return CategoryResource::collection($query->paginate($perPage));
    }

    public function restore(string $id): CategoryResource
    {
        $this->authorize('restore', Category::class);

        $category = Category::onlyTrashed()->findOrFail($id);
        $category->restore();

        return new CategoryResource($category->fresh()->loadCount('services'));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Category::class);

        $category = Category::onlyTrashed()->findOrFail($id);
        $category->forceDelete();

        return response()->json(null, 204);
    }
}
