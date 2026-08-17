<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingCategory;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class AccountingCategoryController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/accounting/categories',
        summary: 'Lister les catégories comptables',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des catégories'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $categories = AccountingCategory::query()
            ->with('agency:id,name')
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->agency_id, fn ($q, $id) => $q->where(fn ($q) => $q->where('agency_id', $id)->orWhereNull('agency_id')))
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    #[OA\Post(
        path: '/api/accounting/categories',
        summary: 'Créer une catégorie comptable',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Catégorie créée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['income', 'expense'])],
            'agency_id' => ['nullable', 'exists:agencies,id'],
        ]);

        $category = AccountingCategory::create($data);

        $this->logger->log(
            action: 'created',
            entityType: 'accounting-category',
            entityId: $category->id,
            description: "Catégorie comptable {$category->name} créée",
            request: $request,
        );

        return response()->json($category->fresh()->load('agency'), 201);
    }

    #[OA\Put(
        path: '/api/accounting/categories/{category}',
        summary: 'Modifier une catégorie comptable',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Catégorie modifiée'),
            new OA\Response(response: 422, description: 'Catégorie système'),
        ]
    )]
    public function update(Request $request, AccountingCategory $category): JsonResponse
    {
        abort_if($category->is_system, 422, 'Une catégorie système ne peut pas être modifiée.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['income', 'expense'])],
            'agency_id' => ['nullable', 'exists:agencies,id'],
        ]);

        $category->update($data);

        return response()->json($category->fresh()->load('agency'));
    }

    #[OA\Delete(
        path: '/api/accounting/categories/{category}',
        summary: 'Supprimer une catégorie comptable',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Catégorie supprimée'),
            new OA\Response(response: 422, description: 'Catégorie système'),
        ]
    )]
    public function destroy(Request $request, AccountingCategory $category): JsonResponse
    {
        abort_if($category->is_system, 422, 'Une catégorie système ne peut pas être supprimée.');

        $name = $category->name;
        $category->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'accounting-category',
            entityId: $category->id,
            description: "Catégorie comptable {$name} supprimée",
            request: $request,
        );

        return response()->json(null, 204);
    }
}
