<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAgencyRequest;
use App\Http\Requests\Api\UpdateAgencyRequest;
use App\Models\Agency;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class AgencyController extends Controller
{
    #[OA\Get(
        path: '/api/agencies',
        summary: 'Lister toutes les agences',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Liste des agences',
                content: new OA\JsonContent(type: 'array', items: new OA\Items(ref: '#/components/schemas/Agency'))
            ),
        ]
    )]
    public function index(): JsonResponse
    {
        return response()->json(Agency::with('manager', 'departments')->get());
    }

    #[OA\Post(
        path: '/api/agencies',
        summary: 'Créer une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['code', 'name', 'country'],
                properties: [
                    new OA\Property(property: 'code', type: 'string', example: 'AG-001'),
                    new OA\Property(property: 'name', type: 'string', example: 'Agence Paris'),
                    new OA\Property(property: 'country', type: 'string', example: 'France'),
                    new OA\Property(property: 'city', type: 'string', example: 'Paris'),
                    new OA\Property(property: 'address', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Agence créée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreAgencyRequest $request): JsonResponse
    {
        $agency = Agency::create($request->validated());
        return response()->json($agency->load('manager', 'departments'), 201);
    }

    #[OA\Get(
        path: '/api/agencies/{agency}',
        summary: 'Afficher une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'agence', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
        ]
    )]
    public function show(Agency $agency): JsonResponse
    {
        return response()->json($agency->load('manager', 'departments', 'users'));
    }

    #[OA\Put(
        path: '/api/agencies/{agency}',
        summary: 'Modifier une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'code', type: 'string'),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'country', type: 'string'),
                    new OA\Property(property: 'city', type: 'string'),
                    new OA\Property(property: 'address', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                    new OA\Property(property: 'email', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Agence modifiée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
        ]
    )]
    public function update(UpdateAgencyRequest $request, Agency $agency): JsonResponse
    {
        $agency->update($request->validated());
        return response()->json($agency->fresh()->load('manager', 'departments'));
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}',
        summary: 'Supprimer une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Agence supprimée'),
        ]
    )]
    public function destroy(Agency $agency): JsonResponse
    {
        $agency->delete();
        return response()->json(null, 204);
    }
}
