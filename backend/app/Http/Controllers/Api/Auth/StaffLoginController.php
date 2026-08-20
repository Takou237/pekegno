<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class StaffLoginController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    #[OA\Post(
        path: '/api/staff/login',
        summary: 'Connecter un employé (portail personnel)',
        tags: ['Authentification'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'password', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Connexion employé réussie'),
            new OA\Response(response: 422, description: 'Identifiants invalides, compte désactivé ou non employé'),
        ]
    )]
    public function __invoke(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->attemptForPortal(
            credentials: $request->validated(),
            portal: 'staff',
            ip: $request->ip(),
            userAgent: $request->userAgent(),
        );

        return response()->json($result);
    }
}