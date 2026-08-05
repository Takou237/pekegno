<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RegisterRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class RegisterController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}
    #[OA\Post(
        path: '/api/auth/register',
        summary: 'Inscription publique (client)',
        tags: ['Authentification'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['first_name', 'last_name', 'email', 'password'],
                properties: [
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'phone', type: 'string', nullable: true),
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'password_confirmation', type: 'string', format: 'password'),
                    new OA\Property(property: 'city', type: 'string', nullable: true),
                    new OA\Property(property: 'country', type: 'string', nullable: true),
                    new OA\Property(property: 'address', type: 'string', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Compte créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function __invoke(RegisterRequest $request): JsonResponse
    {
        $clientRole = Role::where('name', 'client')->first();

        if (! $clientRole) {
            return response()->json([
                'message' => 'L\'inscription est temporairement indisponible.',
            ], 503);
        }

        $user = User::create([
            'username' => $request->input('email'),
            'email' => $request->input('email'),
            'password' => $request->input('password'),
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'phone' => $request->input('phone'),
            'city' => $request->input('city'),
            'country' => $request->input('country'),
            'address' => $request->input('address'),
            'role_id' => $clientRole->id,
            'is_active' => true,
            'is_password_change_required' => false,
        ]);

        $user->update(['client_number' => User::generateClientNumber()]);

        $this->activityLogger->log(
            action: 'created',
            entityType: 'client',
            entityId: $user->id,
            description: 'Inscription publique d\'un client',
            request: $request,
        );

        return response()->json([
            'message' => 'Compte créé avec succès.',
            'user' => $user->load('role'),
        ], 201);
    }
}
