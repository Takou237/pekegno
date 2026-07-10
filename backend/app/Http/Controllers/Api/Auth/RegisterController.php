<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class RegisterController extends Controller
{
    public function __construct(
        private readonly AuthService $authService
    ) {}

    #[OA\Post(
        path: '/auth/register',
        summary: 'Inscrire un nouvel utilisateur',
        tags: ['Authentification'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['username', 'email', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'username', type: 'string', example: 'jean.dupont'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'jean@email.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password'),
                    new OA\Property(property: 'password_confirmation', type: 'string', example: 'password'),
                    new OA\Property(property: 'first_name', type: 'string', example: 'Jean'),
                    new OA\Property(property: 'last_name', type: 'string', example: 'Dupont'),
                    new OA\Property(property: 'phone', type: 'string', example: '+33612345678'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Inscription réussie',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'user', ref: '#/components/schemas/User'),
                        new OA\Property(property: 'token', type: 'string'),
                    ]
                )
            ),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'first_name' => ['sometimes', 'string', 'max:150'],
            'last_name' => ['sometimes', 'string', 'max:150'],
            'phone' => ['sometimes', 'string', 'max:50'],
        ]);

        $result = $this->authService->register(
            data: $validated,
            ip: $request->ip(),
            userAgent: $request->userAgent(),
        );

        return response()->json($result, 201);
    }
}
