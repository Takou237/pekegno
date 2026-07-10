<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreRoleRequest;
use App\Http\Requests\Api\UpdateRoleRequest;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RoleController extends Controller
{
    #[OA\Get(
        path: '/api/roles',
        summary: 'Lister tous les rôles',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Liste des rôles',
                content: new OA\JsonContent(type: 'array', items: new OA\Items(ref: '#/components/schemas/Role'))
            ),
        ]
    )]
    public function index(): JsonResponse
    {
        return response()->json(Role::with('permissions')->get());
    }

    #[OA\Post(
        path: '/api/roles',
        summary: 'Créer un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'editor'),
                    new OA\Property(property: 'description', type: 'string', example: 'Éditeur de contenu'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Rôle créé', content: new OA\JsonContent(ref: '#/components/schemas/Role')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreRoleRequest $request): JsonResponse
    {
        $role = Role::create($request->validated());
        return response()->json($role, 201);
    }

    #[OA\Get(
        path: '/api/roles/{role}',
        summary: 'Afficher un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du rôle', content: new OA\JsonContent(ref: '#/components/schemas/Role')),
            new OA\Response(response: 404, description: 'Rôle non trouvé'),
        ]
    )]
    public function show(Role $role): JsonResponse
    {
        return response()->json($role->load('permissions'));
    }

    #[OA\Put(
        path: '/api/roles/{role}',
        summary: 'Modifier un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Rôle modifié', content: new OA\JsonContent(ref: '#/components/schemas/Role')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateRoleRequest $request, Role $role): JsonResponse
    {
        $role->update($request->validated());
        return response()->json($role);
    }

    #[OA\Delete(
        path: '/api/roles/{role}',
        summary: 'Supprimer un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Rôle supprimé'),
            new OA\Response(response: 403, description: 'Impossible de supprimer un rôle système'),
        ]
    )]
    public function destroy(Role $role): JsonResponse
    {
        if ($role->is_system) {
            return response()->json(['message' => 'Impossible de supprimer un rôle système.'], 403);
        }
        $role->delete();
        return response()->json(null, 204);
    }
}
