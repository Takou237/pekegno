<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAgencyRequest;
use App\Http\Requests\Api\UpdateAgencyRequest;
use App\Http\Resources\AgencyResource;
use App\Models\Agency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class AgencyController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Agency::class, 'agency');
    }

    #[OA\Get(
        path: '/api/agencies',
        summary: 'Lister les agences avec pagination, recherche et filtres',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom, code, email, ville ou pays', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'country', in: 'query', description: 'Filtrer par pays', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', description: 'Nombre de résultats par page', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', description: 'Champ de tri', schema: new OA\Schema(type: 'string', enum: ['name', 'code', 'country', 'created_at'])),
            new OA\Parameter(name: 'sort_order', in: 'query', description: 'Ordre de tri', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des agences'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Agency::with('departments')
            ->search($request->input('search'))
            ->byCountry($request->input('country'));

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSorts = ['name', 'code', 'country', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $agencies = $query->paginate($perPage);

        return AgencyResource::collection($agencies);
    }

    #[OA\Post(
        path: '/api/agencies',
        summary: 'Créer une nouvelle agence',
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
                    new OA\Property(property: 'address', type: 'string', example: '123 Rue de la Paix'),
                    new OA\Property(property: 'phone', type: 'string', example: '+33123456789'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'contact@agence.fr'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Agence créée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreAgencyRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['code'] = Agency::generateNextCode();

        $agency = Agency::create($data);

        return (new AgencyResource($agency->load('departments')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/agencies/{agency}',
        summary: 'Afficher le détail d\'une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'agence', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
        ]
    )]
    public function show(Agency $agency): AgencyResource
    {
        return new AgencyResource($agency->load('departments', 'assignedUsers'));
    }

    #[OA\Put(
        path: '/api/agencies/{agency}',
        summary: 'Modifier une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'code', type: 'string'),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'country', type: 'string'),
                    new OA\Property(property: 'city', type: 'string'),
                    new OA\Property(property: 'address', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Agence modifiée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateAgencyRequest $request, Agency $agency): AgencyResource
    {
        $agency->update($request->validated());

        return new AgencyResource($agency->fresh()->load('departments'));
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}',
        summary: 'Supprimer une agence (soft delete)',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Agence supprimée'),
            new OA\Response(response: 409, description: 'Conflit - agence a des dépendances'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Agency $agency): JsonResponse
    {
        if ($agency->departments()->exists() || $agency->assignedUsers()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer cette agence car elle contient des départements ou des utilisateurs assignés.',
            ], 409);
        }

        $agency->delete();

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/agencies/trash',
        summary: 'Lister les agences supprimées (corbeille)',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des agences supprimées'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Agency::onlyTrashed()
            ->with('departments')
            ->search($request->input('search'));

        $perPage = min((int) $request->input('per_page', 15), 100);

        return AgencyResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/agencies/{agency}/restore',
        summary: 'Restaurer une agence supprimée',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Agence restaurée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 404, description: 'Agence non trouvée dans la corbeille'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function restore(string $id): AgencyResource
    {
        $this->authorize('restore', Agency::class);

        $agency = Agency::onlyTrashed()->findOrFail($id);
        $agency->restore();

        return new AgencyResource($agency->load('departments'));
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}/force-delete',
        summary: 'Supprimer définitivement une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Agence supprimée définitivement'),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Agency::class);

        $agency = Agency::onlyTrashed()->findOrFail($id);

        if ($agency->departments()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer définitivement cette agence car elle contient des départements.',
            ], 409);
        }

        $agency->forceDelete();

        return response()->json(null, 204);
    }
}
