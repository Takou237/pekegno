<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ProfileController extends Controller
{
    #[OA\Get(
        path: '/api/user',
        summary: 'Afficher le profil de l\'utilisateur connecté',
        tags: ['Profil'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Profil utilisateur',
                content: new OA\JsonContent(ref: '#/components/schemas/User')
            ),
            new OA\Response(response: 401, description: 'Non authentifié'),
        ]
    )]
    public function __invoke(Request $request)
    {
        return new UserResource($request->user()->load('role', 'assignments'));
    }
}
