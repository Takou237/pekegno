<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientLogoutController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    #[OA\Post(
        path: '/api/client/logout',
        summary: 'Déconnecter un client (révoque le token)',
        tags: ['Authentification client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Déconnecté'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $this->authService->logout($request->user(), $request->ip(), $request->userAgent());

        return response()->json(null, 204);
    }
}