<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePromotionRequest;
use App\Http\Requests\Api\UpdatePromotionRequest;
use App\Http\Resources\PromotionResource;
use App\Models\Promotion;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class PromotionController extends Controller
{
    #[OA\Get(
        path: '/api/promotions',
        summary: 'Lister les promotions avec pagination et filtres',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service_id', in: 'query', description: 'Filtrer par service', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', description: 'Filtrer par statut', schema: new OA\Schema(type: 'string', enum: ['active', 'expired'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des promotions'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Promotion::with('service')
            ->when($request->service_id, fn ($q, $serviceId) => $q->where('service_id', $serviceId))
            ->when($request->status === 'active', fn ($q) => $q->active())
            ->when($request->status === 'expired', fn ($q) => $q->expired())
            ->orderByDesc('created_at');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return PromotionResource::collection($query->paginate($perPage));
    }

    #[OA\Get(
        path: '/api/services/{service}/promotions',
        summary: 'Lister les promotions d\'un service',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste des promotions du service'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function indexForService(Service $service): JsonResponse
    {
        $this->authorize('view', $service);

        return response()->json(PromotionResource::collection(
            $service->promotions()->orderByDesc('created_at')->get()
        ));
    }

    #[OA\Post(
        path: '/api/services/{service}/promotions',
        summary: 'Créer une promotion pour un service',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['promotional_price', 'start_date', 'end_date'],
                properties: [
                    new OA\Property(property: 'promotional_price', type: 'number', format: 'float', example: 20000),
                    new OA\Property(property: 'start_date', type: 'string', format: 'date-time', example: '2026-08-01T00:00:00'),
                    new OA\Property(property: 'end_date', type: 'string', format: 'date-time', example: '2026-08-31T23:59:59'),
                    new OA\Property(property: 'is_active', type: 'boolean', default: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Promotion créée', content: new OA\JsonContent(ref: '#/components/schemas/Promotion')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StorePromotionRequest $request, Service $service): JsonResponse
    {
        $this->authorize('update', $service);

        $promotion = $service->promotions()->create($request->validated());

        return (new PromotionResource($promotion->load('service')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Put(
        path: '/api/promotions/{promotion}',
        summary: 'Modifier une promotion',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'promotion', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'promotional_price', type: 'number', format: 'float'),
                    new OA\Property(property: 'start_date', type: 'string', format: 'date-time'),
                    new OA\Property(property: 'end_date', type: 'string', format: 'date-time'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Promotion modifiée', content: new OA\JsonContent(ref: '#/components/schemas/Promotion')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdatePromotionRequest $request, Promotion $promotion): PromotionResource
    {
        $this->authorize('update', $promotion->service);

        $promotion->update($request->validated());

        return new PromotionResource($promotion->fresh()->load('service'));
    }

    #[OA\Delete(
        path: '/api/promotions/{promotion}',
        summary: 'Supprimer une promotion',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'promotion', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Promotion supprimée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Promotion $promotion): JsonResponse
    {
        $this->authorize('update', $promotion->service);

        $promotion->delete();

        return response()->json(null, 204);
    }
}
