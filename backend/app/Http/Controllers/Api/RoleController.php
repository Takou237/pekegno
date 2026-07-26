<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
            new OA\Response(response: 200, description: 'Liste des rôles'),
        ]
    )]
    public function index(): JsonResponse
    {
        $roles = Role::orderBy('name')->get();

        return response()->json($roles);
    }
}
