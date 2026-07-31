<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreServiceRequest;
use App\Http\Requests\Api\UpdateServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class ServiceController extends Controller
{
    private const ALLOWED_WITH = ['category', 'agency', 'department', 'promotions', 'priceHistory', 'activePromotion'];

    public function __construct()
    {
        $this->authorizeResource(Service::class, 'service');
    }

    private function parseWith(Request $request): array
    {
        $with = $request->input('with');
        if (! $with) {
            return [];
        }
        $relations = array_map('trim', explode(',', $with));

        return array_intersect($relations, self::ALLOWED_WITH);
    }

    private function defaultLoads(array $extra = []): array
    {
        return array_unique(array_merge(
            ['category', 'agency', 'department', 'activePromotion', 'priceHistory.changedBy'],
            $extra,
        ));
    }

    private function recordPriceHistory(Service $service, ?string $reason = null): void
    {
        $service->priceHistory()->create([
            'price' => $service->price,
            'changed_by' => auth()->id(),
            'reason' => $reason ?? 'Prix initial',
        ]);
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
            new OA\Parameter(name: 'with_promotions', in: 'query', description: 'Ne lister que les services avec une promotion active', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'price', 'created_at'])),
            new OA\Parameter(name: 'sort_order', in: 'query', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des services'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Service::with($this->defaultLoads())
            ->search($request->input('search'))
            ->ofCategory($request->input('category_id'))
            ->ofAgency($request->input('agency_id'))
            ->ofDepartment($request->input('department_id'))
            ->when(filter_var($request->input('with_promotions'), FILTER_VALIDATE_BOOLEAN), function ($q) {
                $q->whereHas('activePromotion');
            });

        if ($request->user()?->role?->name === 'responsable-agence') {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $request->user()->id)
                ->where('is_primary', true)
                ->pluck('agency_id');
            $query->where(fn ($q) => $q
                ->whereIn('agency_id', $agencyIds)
                ->orWhereIn('department_id', DB::table('departments')->whereIn('agency_id', $agencyIds)->pluck('id')));
        }

        if ($request->user()?->role?->name === 'responsable-departement') {
            $deptIds = DB::table('department_chiefs')
                ->where('user_id', $request->user()->id)
                ->pluck('department_id');
            $query->whereIn('department_id', $deptIds);
        }

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSorts = ['name', 'price', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $services = $query->paginate($perPage);

        return ServiceResource::collection($services);
    }

    #[OA\Post(
        path: '/api/services',
        summary: 'Créer un service',
        tags: ['Services'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'category_id', 'price'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Formation Marketing Digital'),
                    new OA\Property(property: 'category_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'price', type: 'number', format: 'float', example: 25000),
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid', nullable: true),
                    new OA\Property(property: 'department_id', type: 'string', format: 'uuid', nullable: true),
                    new OA\Property(property: 'coverage', type: 'string', example: 'Nationale'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'presentation_video', type: 'string', example: 'https://cdn.pekegno.com/videos/presentation.mp4'),
                    new OA\Property(property: 'reason', type: 'string', nullable: true),
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
        $service = DB::transaction(function () use ($request) {
            $service = Service::create($request->safe()->except(['reason']));
            $this->recordPriceHistory($service, $request->input('reason'));

            return $service;
        });

        return (new ServiceResource($service->load($this->defaultLoads())))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/services/{service}',
        summary: "Afficher le détail d'un service",
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
            $this->defaultLoads(['promotions']),
            $this->parseWith($request),
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
                    new OA\Property(property: 'price', type: 'number', format: 'float'),
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid', nullable: true),
                    new OA\Property(property: 'department_id', type: 'string', format: 'uuid', nullable: true),
                    new OA\Property(property: 'coverage', type: 'string'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'presentation_video', type: 'string'),
                    new OA\Property(property: 'reason', type: 'string', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Service modifié', content: new OA\JsonContent(ref: '#/components/schemas/Service')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Service non trouvé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateServiceRequest $request, Service $service): ServiceResource
    {
        $data = $request->safe()->except(['reason']);
        $reason = $request->input('reason');

        DB::transaction(function () use ($service, $data, $reason) {
            $priceChanged = isset($data['price'])
                && abs((float) $data['price'] - (float) $service->price) > 0.0001;

            $service->update($data);

            if ($priceChanged) {
                $this->recordPriceHistory($service, $reason ?? 'Mise à jour du prix');
            }
        });

        return new ServiceResource($service->fresh()->load($this->defaultLoads(['promotions'])));
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

    #[OA\Get(
        path: '/api/services/trash',
        summary: 'Lister les services supprimés (corbeille)',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des services supprimés'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Service::onlyTrashed()
            ->with(['category', 'agency', 'department'])
            ->search($request->input('search'))
            ->orderBy('deleted_at', 'desc');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return ServiceResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/services/{service}/restore',
        summary: 'Restaurer un service supprimé',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Service restauré', content: new OA\JsonContent(ref: '#/components/schemas/Service')),
            new OA\Response(response: 404, description: 'Service non trouvé dans la corbeille'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function restore(string $id): ServiceResource
    {
        $this->authorize('restore', Service::class);

        $service = Service::onlyTrashed()->findOrFail($id);
        $service->restore();

        return new ServiceResource($service->fresh()->load($this->defaultLoads()));
    }

    #[OA\Delete(
        path: '/api/services/{service}/force-delete',
        summary: 'Supprimer définitivement un service',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Service supprimé définitivement'),
            new OA\Response(response: 404, description: 'Service non trouvé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Service::class);

        $service = Service::onlyTrashed()->findOrFail($id);

        $service->priceHistory()->delete();
        $service->promotions()->delete();
        $service->forceDelete();

        return response()->json(null, 204);
    }
}
