<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateClientProfileRequest;
use App\Http\Resources\UserResource;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientMeController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

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

    #[OA\Put(
        path: '/api/client/me',
        summary: 'Mettre à jour le profil du client connecté',
        tags: ['Authentification client'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string', nullable: true),
                    new OA\Property(property: 'city', type: 'string', nullable: true),
                    new OA\Property(property: 'country', type: 'string', nullable: true),
                    new OA\Property(property: 'address', type: 'string', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Profil mis à jour'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateClientProfileRequest $request)
    {
        $user = $request->user();
        $user->update($request->validated());

        $this->activityLogger->log(
            action: 'updated',
            entityType: 'client',
            entityId: $user->id,
            description: 'Mise à jour du profil par le client',
            request: $request,
        );

        return new UserResource($user->load('role', 'clientCategory'));
    }
}