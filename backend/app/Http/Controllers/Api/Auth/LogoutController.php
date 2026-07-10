<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class LogoutController extends Controller
{
    public function __construct(
        private readonly AuthService $authService
    ) {}

    #[OA\Post(
        path: '/api/auth/logout',
        summary: 'Déconnecter l\'utilisateur courant',
        tags: ['Authentification'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Déconnexion réussie'),
            new OA\Response(response: 401, description: 'Non authentifié'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $this->authService->logout(
            user: $request->user(),
            ip: $request->ip(),
            userAgent: $request->userAgent(),
        );

        return response()->json(['message' => 'Déconnexion réussie.']);
    }
}
