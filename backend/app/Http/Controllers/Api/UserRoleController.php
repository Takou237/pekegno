<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AssignRoleRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class UserRoleController extends Controller
{
    #[OA\Get(
        path: '/api/users/{user}/roles',
        summary: 'Afficher le rôle d\'un utilisateur',
        tags: ['Utilisateurs - Rôles'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rôle de l\'utilisateur'),
        ]
    )]
    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('role'));
    }

    #[OA\Put(
        path: '/api/users/{user}/roles',
        summary: 'Attribuer un rôle à un utilisateur',
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
    public function update(User $user, AssignRoleRequest $request): JsonResponse
    {
        $roleId = $request->validated('role_id');
        $user->update(['role_id' => $roleId]);
        return response()->json($user->fresh()->load('role'));
    }
}
