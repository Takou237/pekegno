<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientMeController extends Controller
{
    #[OA\Get(
        path: '/api/client/me',
        summary: 'Afficher le profil du client connecté',
        tags: ['Authentification client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Profil client'),
            new OA\Response(response: 401, description: 'Non authentifié'),
        ]
    )]
    public function __invoke(Request $request)
    {
        return new UserResource($request->user()->load('role', 'clientCategory'));
    }
}