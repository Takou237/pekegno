<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePermissionRequest;
use App\Http\Requests\Api\UpdatePermissionRequest;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class PermissionController extends Controller
{
    #[OA\Get(
        path: '/permissions',
        summary: 'Lister toutes les permissions',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Liste des permissions',
                content: new OA\JsonContent(type: 'array', items: new OA\Items(ref: '#/components/schemas/Permission'))
            ),
        ]
    )]
    public function index(): JsonResponse
    {
        return response()->json(Permission::all());
    }

    #[OA\Post(
        path: '/permissions',
        summary: 'Créer une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'reports.view'),
                    new OA\Property(property: 'label', type: 'string', example: 'Voir les rapports'),
                    new OA\Property(property: 'group', type: 'string', example: 'reports'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Permission créée', content: new OA\JsonContent(ref: '#/components/schemas/Permission')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StorePermissionRequest $request): JsonResponse
    {
        $permission = Permission::create($request->validated());
        return response()->json($permission, 201);
    }

    #[OA\Get(
        path: '/permissions/{permission}',
        summary: 'Afficher une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la permission', content: new OA\JsonContent(ref: '#/components/schemas/Permission')),
            new OA\Response(response: 404, description: 'Permission non trouvée'),
        ]
    )]
    public function show(Permission $permission): JsonResponse
    {
        return response()->json($permission);
    }

    #[OA\Put(
        path: '/permissions/{permission}',
        summary: 'Modifier une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'label', type: 'string'),
                    new OA\Property(property: 'group', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Permission modifiée', content: new OA\JsonContent(ref: '#/components/schemas/Permission')),
        ]
    )]
    public function update(UpdatePermissionRequest $request, Permission $permission): JsonResponse
    {
        $permission->update($request->validated());
        return response()->json($permission);
    }

    #[OA\Delete(
        path: '/permissions/{permission}',
        summary: 'Supprimer une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Permission supprimée'),
        ]
    )]
    public function destroy(Permission $permission): JsonResponse
    {
        $permission->delete();
        return response()->json(null, 204);
    }
}
