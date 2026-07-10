<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDepartmentRequest;
use App\Http\Requests\Api\UpdateDepartmentRequest;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class DepartmentController extends Controller
{
    #[OA\Get(
        path: '/api/departments',
        summary: 'Lister tous les départements',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Liste des départements',
                content: new OA\JsonContent(type: 'array', items: new OA\Items(ref: '#/components/schemas/Department'))
            ),
        ]
    )]
    public function index(): JsonResponse
    {
        return response()->json(Department::with('agency', 'manager')->get());
    }

    #[OA\Post(
        path: '/api/departments',
        summary: 'Créer un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['agency_id', 'name'],
                properties: [
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid', description: "UUID de l'agence (récupéré via GET /api/agencies)"),
                    new OA\Property(property: 'name', type: 'string', example: 'Service Commercial'),
                    new OA\Property(property: 'description', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Département créé', content: new OA\JsonContent(ref: '#/components/schemas/Department')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        $department = Department::create($request->validated());
        return response()->json($department->load('agency', 'manager'), 201);
    }

    #[OA\Get(
        path: '/api/departments/{department}',
        summary: 'Afficher un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du département', content: new OA\JsonContent(ref: '#/components/schemas/Department')),
            new OA\Response(response: 404, description: 'Département non trouvé'),
        ]
    )]
    public function show(Department $department): JsonResponse
    {
        return response()->json($department->load('agency', 'manager'));
    }

    #[OA\Put(
        path: '/api/departments/{department}',
        summary: 'Modifier un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid', description: "UUID de l'agence (récupéré via GET /api/agencies)"),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'description', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Département modifié', content: new OA\JsonContent(ref: '#/components/schemas/Department')),
        ]
    )]
    public function update(UpdateDepartmentRequest $request, Department $department): JsonResponse
    {
        $department->update($request->validated());
        return response()->json($department->fresh()->load('agency', 'manager'));
    }

    #[OA\Delete(
        path: '/api/departments/{department}',
        summary: 'Supprimer un département',
        tags: ['Départements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Département supprimé'),
        ]
    )]
    public function destroy(Department $department): JsonResponse
    {
        $department->delete();
        return response()->json(null, 204);
    }
}
