<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AssignRoleRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class UserRoleController extends Controller
{
    #[OA\Post(
        path: '/api/users/{user}/roles',
        summary: 'Assigner un rôle à un utilisateur',
        tags: ['Utilisateurs - Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['role_id'],
                properties: [
                    new OA\Property(property: 'role_id', type: 'string', format: 'uuid'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Rôle assigné'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignRole(User $user, AssignRoleRequest $request): JsonResponse
    {
        $roleId = $request->validated('role_id');
        $user->roles()->syncWithoutDetaching([$roleId]);
        return response()->json($user->load('roles'));
    }

    #[OA\Delete(
        path: '/api/users/{user}/roles/{role}',
        summary: 'Retirer un rôle à un utilisateur',
        tags: ['Utilisateurs - Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rôle retiré'),
        ]
    )]
    public function removeRole(User $user, string $role): JsonResponse
    {
        $user->roles()->detach($role);
        return response()->json($user->load('roles'));
    }

    #[OA\Get(
        path: '/api/users/{user}/roles',
        summary: 'Lister les rôles d\'un utilisateur',
        tags: ['Utilisateurs - Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rôles de l\'utilisateur'),
        ]
    )]
    public function listRoles(User $user): JsonResponse
    {
        return response()->json($user->load('roles'));
    }
}
