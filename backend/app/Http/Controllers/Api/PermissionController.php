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
        path: '/api/permissions',
        summary: 'Lister toutes les permissions',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des permissions'),
        ]
    )]
    public function index(): JsonResponse
    {
        $permissions = Permission::orderBy('name')->get();

        return response()->json($permissions);
    }

    #[OA\Post(
        path: '/api/permissions',
        summary: 'Créer une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Permission créée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StorePermissionRequest $request): JsonResponse
    {
        $permission = Permission::create($request->only(['name', 'label', 'description']));

        return response()->json($permission, 201);
    }

    #[OA\Put(
        path: '/api/permissions/{permission}',
        summary: 'Modifier une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'permission', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Permission modifiée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdatePermissionRequest $request, Permission $permission): JsonResponse
    {
        $permission->update($request->only(['name', 'label', 'description']));

        return response()->json($permission->fresh());
    }

    #[OA\Delete(
        path: '/api/permissions/{permission}',
        summary: 'Supprimer une permission',
        tags: ['Permissions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'permission', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Permission supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Permission utilisée par des rôles'),
        ]
    )]
    public function destroy(Permission $permission): JsonResponse
    {
        $user = request()->user();

        if (! in_array($user?->role?->name, ['super-admin', 'direction-generale'], true)) {
            return response()->json([
                'message' => 'Vous n\'êtes pas autorisé à supprimer des permissions.',
            ], 403);
        }

        if ($permission->roles()->exists()) {
            return response()->json([
                'message' => 'Cette permission est utilisée par des rôles et ne peut pas être supprimée.',
            ], 422);
        }

        $permission->delete();

        return response()->json(['message' => 'Permission supprimée avec succès.']);
    }
}
