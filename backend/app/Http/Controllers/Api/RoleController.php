<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreRoleRequest;
use App\Http\Requests\Api\SyncRolePermissionsRequest;
use App\Http\Requests\Api\UpdateRoleRequest;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RoleController extends Controller
{
    private const PROTECTED_ROLES = ['super-admin', 'direction-generale', 'client'];

    #[OA\Get(
        path: '/api/roles',
        summary: 'Lister tous les rôles',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des rôles'),
        ]
    )]
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')->orderBy('name')->get();

        return response()->json($roles);
    }

    #[OA\Post(
        path: '/api/roles',
        summary: 'Créer un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Rôle créé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreRoleRequest $request): JsonResponse
    {
        $role = Role::create($request->only(['name', 'description']));

        if ($request->filled('permissions')) {
            $role->permissions()->sync($request->input('permissions'));
        }

        return response()->json($role->load('permissions'), 201);
    }

    #[OA\Put(
        path: '/api/roles/{role}',
        summary: 'Modifier un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rôle modifié'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateRoleRequest $request, Role $role): JsonResponse
    {
        $role->update($request->only(['name', 'description']));

        if ($request->has('permissions')) {
            $role->permissions()->sync($request->input('permissions', []));
        }

        return response()->json($role->fresh()->load('permissions'));
    }

    #[OA\Put(
        path: '/api/roles/{role}/permissions',
        summary: 'Synchroniser les permissions d\'un rôle',
        tags: ['Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Permissions synchronisées'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function syncPermissions(SyncRolePermissionsRequest $request, Role $role): JsonResponse
    {
        $role->permissions()->sync($request->input('permissions', []));

        return response()->json($role->fresh()->load('permissions'));
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
            new OA\Response(response: 200, description: 'Rôle supprimé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 422, description: 'Rôle protégé ou attribué'),
        ]
    )]
    public function destroy(Role $role): JsonResponse
    {
        $user = request()->user();

        if (! in_array($user?->role?->name, self::PROTECTED_ROLES, true)) {
            return response()->json([
                'message' => 'Vous n\'êtes pas autorisé à supprimer des rôles.',
            ], 403);
        }

        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return response()->json([
                'message' => 'Ce rôle système ne peut pas être supprimé.',
            ], 422);
        }

        if ($role->users()->exists()) {
            return response()->json([
                'message' => 'Ce rôle est attribué à des utilisateurs et ne peut pas être supprimé.',
            ], 422);
        }

        $role->permissions()->detach();
        $role->delete();

        return response()->json(['message' => 'Rôle supprimé avec succès.']);
    }
}
