<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreServiceRequest;
use App\Http\Requests\Api\UpdateServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Formation;
use App\Models\PriceHistory;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class ServiceController extends Controller
{
    private const ALLOWED_WITH = ['category', 'agency', 'department', 'promotions', 'priceHistory', 'formation'];

    public function __construct()
    {
        $this->authorizeResource(Service::class, 'service');
    }

    private function parseWith(Request $request): array
    {
        $with = $request->input('with');
        if (!$with) return [];
        $relations = array_map('trim', explode(',', $with));
        return array_intersect($relations, self::ALLOWED_WITH);
    }

    #[OA\Get(
        path: '/api/services',
        summary: 'Lister les services avec pagination, recherche et filtres',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'category_id', in: 'query', description: 'Filtrer par catégorie', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Filtrer par agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'department_id', in: 'query', description: 'Filtrer par département', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'is_formation', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'price', 'created_at'], default: 'name')),
            new OA\Parameter(name: 'sort_order', in: 'query', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des services'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $defaultWith = ['category', 'agency', 'department', 'promotions', 'formation'];

        $query = Service::with(array_merge($defaultWith, $this->parseWith($request)))
            ->search($request->input('search'))
            ->when($request->category_id, fn ($q, $v) => $q->where('category_id', $v))
            ->when($request->agency_id, fn ($q, $v) => $q->where('agency_id', $v))
            ->when($request->department_id, fn ($q, $v) => $q->where('department_id', $v))
            ->when($request->boolean('is_formation'), fn ($q) => $q->whereHas('formation'));

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSorts = ['name', 'price', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        return ServiceResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/services',
        summary: 'Créer un service (et éventuellement sa formation)',
        tags: ['Services'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'category_id', 'price'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Formation Excel'),
                    new OA\Property(property: 'category_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'department_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'price', type: 'number', example: 50000),
                    new OA\Property(property: 'cover_image', type: 'string'),
                    new OA\Property(property: 'presentation_video', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Service créé', content: new OA\JsonContent(ref: '#/components/schemas/Service')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreServiceRequest $request): JsonResponse
    {
        $data = $request->validated();
        $formationData = $data['formation'] ?? null;
        unset($data['formation']);

        $service = Service::create($data);

        PriceHistory::create([
            'service_id' => $service->id,
            'price' => $service->price,
            'changed_at' => now(),
        ]);

        if (is_array($formationData)) {
            Formation::create(array_merge($formationData, ['id' => $service->id]));
        }

        return (new ServiceResource($service->load(['category', 'agency', 'department', 'promotions', 'formation'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/services/{service}',
        summary: 'Afficher le détail d\'un service',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du service', content: new OA\JsonContent(ref: '#/components/schemas/Service')),
            new OA\Response(response: 404, description: 'Service non trouvé'),
        ]
    )]
    public function show(Request $request, Service $service): ServiceResource
    {
        $with = array_unique(array_merge(
            ['category', 'agency', 'department', 'promotions', 'priceHistory', 'formation'],
            $this->parseWith($request)
        ));

        return new ServiceResource($service->load($with));
    }

    #[OA\Put(
        path: '/api/services/{service}',
        summary: 'Modifier un service',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'category_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'department_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'price', type: 'number'),
                    new OA\Property(property: 'cover_image', type: 'string'),
                    new OA\Property(property: 'presentation_video', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Service modifié', content: new OA\JsonContent(ref: '#/components/schemas/Service')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Service non trouvé'),
        ]
    )]
    public function update(UpdateServiceRequest $request, Service $service): ServiceResource
    {
        $data = $request->validated();
        $formationData = $data['formation'] ?? null;
        unset($data['formation']);

        $oldPrice = $service->price;
        $service->update($data);

        if ($request->filled('price') && (string) $request->input('price') !== (string) $oldPrice) {
            PriceHistory::create([
                'service_id' => $service->id,
                'price' => $service->fresh()->price,
                'changed_at' => now(),
            ]);
        }

        if (is_array($formationData)) {
            if ($service->formation()->exists()) {
                $service->formation()->update($formationData);
            } else {
                Formation::create(array_merge($formationData, ['id' => $service->id]));
            }
        }

        return new ServiceResource($service->fresh()->load([
            'category', 'agency', 'department', 'promotions', 'priceHistory', 'formation',
        ]));
    }

    #[OA\Delete(
        path: '/api/services/{service}',
        summary: 'Supprimer un service (soft delete)',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Service supprimé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Service $service): JsonResponse
    {
        $service->delete();

        return response()->json(null, 204);
    }

    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Service::onlyTrashed()
            ->with(['category', 'agency', 'department', 'formation'])
            ->search($request->input('search'))
            ->orderBy('deleted_at', 'desc');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return ServiceResource::collection($query->paginate($perPage));
    }

    public function restore(string $id): ServiceResource
    {
        $this->authorize('restore', Service::class);

        $service = Service::onlyTrashed()->findOrFail($id);
        $service->restore();

        return new ServiceResource($service->load(['category', 'agency', 'department', 'promotions']));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Service::class);

        $service = Service::onlyTrashed()->findOrFail($id);
        $service->forceDelete();

        return response()->json(null, 204);
    }
}
