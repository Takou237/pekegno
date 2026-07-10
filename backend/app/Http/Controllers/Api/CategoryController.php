<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCategoryRequest;
use App\Http\Requests\Api\UpdateCategoryRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class CategoryController extends Controller
{
    #[OA\Get(
        path: '/api/categories',
        summary: 'Lister toutes les catégories',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Liste des catégories',
                content: new OA\JsonContent(type: 'array', items: new OA\Items(ref: '#/components/schemas/Category'))
            ),
        ]
    )]
    public function index(): JsonResponse
    {
        return response()->json(Category::all());
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
                    new OA\Property(property: 'name', type: 'string', example: 'Formation'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'color', type: 'string', example: '#3B82F6'),
                    new OA\Property(property: 'icon', type: 'string', example: 'book'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Catégorie créée', content: new OA\JsonContent(ref: '#/components/schemas/Category')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = Category::create($request->validated());
        return response()->json($category, 201);
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
    public function show(Category $category): JsonResponse
    {
        return response()->json($category);
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
        ]
    )]
    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category->update($request->validated());
        return response()->json($category);
    }

    #[OA\Delete(
        path: '/api/categories/{category}',
        summary: 'Supprimer une catégorie',
        tags: ['Catégories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'category', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Catégorie supprimée'),
        ]
    )]
    public function destroy(Category $category): JsonResponse
    {
        $category->delete();
        return response()->json(null, 204);
    }
}
