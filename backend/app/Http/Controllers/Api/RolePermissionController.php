<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AssignPermissionRequest;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RolePermissionController extends Controller
{
    #[OA\Post(
        path: '/api/roles/{role}/permissions',
        summary: 'Assigner des permissions à un rôle',
        tags: ['Rôles - Permissions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['permissions'],
                properties: [
                    new OA\Property(
                        property: 'permissions',
                        type: 'array',
                        items: new OA\Items(type: 'string', format: 'uuid'),
                        example: ['uuid-perm-1', 'uuid-perm-2']
                    ),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Permissions assignées'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignPermissions(Role $role, AssignPermissionRequest $request): JsonResponse
    {
        $role->permissions()->sync($request->validated('permissions'));
        return response()->json($role->load('permissions'));
    }

    #[OA\Get(
        path: '/api/roles/{role}/permissions',
        summary: 'Lister les permissions d\'un rôle',
        tags: ['Rôles - Permissions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'role', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Permissions du rôle'),
        ]
    )]
    public function listPermissions(Role $role): JsonResponse
    {
        return response()->json($role->load('permissions'));
    }
}
