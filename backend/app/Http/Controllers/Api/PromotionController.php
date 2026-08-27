<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePromotionRequest;
use App\Http\Resources\PromotionResource;
use App\Models\PriceHistory;
use App\Models\Promotion;
use App\Models\Service;
use App\Models\Course;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class PromotionController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    #[OA\Get(
        path: '/api/promotions',
        summary: 'Lister les promotions avec filtres',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Filtrer par agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'service_id', in: 'query', description: 'Filtrer par service', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', description: 'active, upcoming ou expired', schema: new OA\Schema(type: 'string', enum: ['active', 'upcoming', 'expired'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des promotions'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Promotion::query()
            ->with('service.agency', 'service.category')
            ->when($request->agency_id, function ($q, $agencyId) {
                $q->whereHas('service', fn ($s) => $s->where('agency_id', $agencyId));
            })
            ->when($request->service_id, fn ($q, $serviceId) => $q->where('service_id', $serviceId));

        if ($request->status === 'active') {
            $query->where('start_date', '<=', now())->where('end_date', '>=', now());
        } elseif ($request->status === 'upcoming') {
            $query->where('start_date', '>', now());
        } elseif ($request->status === 'expired') {
            $query->where('end_date', '<', now());
        }

        $query->orderBy('start_date');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return PromotionResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/services/{service}/promotions',
        summary: 'Créer une promotion (amount ou percent) sur un service',
        tags: ['Promotions'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['type', 'start_date', 'end_date'],
                properties: [
                    new OA\Property(property: 'type', type: 'string', enum: ['amount', 'percent'], example: 'percent'),
                    new OA\Property(property: 'promo_price', type: 'number', example: 40000),
                    new OA\Property(property: 'discount_percent', type: 'number', example: 20),
                    new OA\Property(property: 'start_date', type: 'string', format: 'date-time'),
                    new OA\Property(property: 'end_date', type: 'string', format: 'date-time'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Promotion créée'),
            new OA\Response(response: 422, description: 'Erreur de validation ou chevauchement de période'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StorePromotionRequest $request, Service $service): JsonResponse
    {
        $promotion = $service->promotions()->create($request->validated());

        $this->recordPriceHistory($promotion);

        $this->logger->log(
            'created',
            'promotion',
            $promotion->id,
            "Promotion créée sur le service {$service->name}"
                .($promotion->type === 'percent'
                    ? " ({$promotion->discount_percent}%)"
                    : " ({$promotion->promo_price} FCFA)"),
            newValues: $promotion->only(['type', 'promo_price', 'discount_percent', 'start_date', 'end_date']),
        );

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
            required: true,
            content: new OA\JsonContent(
                required: ['type', 'start_date', 'end_date'],
                properties: [
                    new OA\Property(property: 'type', type: 'string', enum: ['amount', 'percent']),
                    new OA\Property(property: 'promo_price', type: 'number'),
                    new OA\Property(property: 'discount_percent', type: 'number'),
                    new OA\Property(property: 'start_date', type: 'string', format: 'date-time'),
                    new OA\Property(property: 'end_date', type: 'string', format: 'date-time'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Promotion modifiée'),
            new OA\Response(response: 422, description: 'Erreur de validation ou chevauchement de période'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(StorePromotionRequest $request, Promotion $promotion): PromotionResource
    {
        $old = $promotion->only(['type', 'promo_price', 'discount_percent', 'start_date', 'end_date']);

        $promotion->update($request->validated());

        $this->recordPriceHistory($promotion);

        $this->logger->log(
            'updated',
            'promotion',
            $promotion->id,
            'Promotion modifiée',
            oldValues: $old,
            newValues: $promotion->only(['type', 'promo_price', 'discount_percent', 'start_date', 'end_date']),
        );

        return new PromotionResource($promotion->load('service'));
    }

    #[OA\Delete(
        path: '/api/promotions/{promotion}',
        summary: 'Supprimer une promotion (le prix redevient celui du service)',
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
    public function destroy(Request $request, Promotion $promotion): JsonResponse
    {
        $service = $promotion->service;

        $promotion->delete();

        if ($service) {
            PriceHistory::create([
                'service_id' => $service->id,
                'price' => $service->price,
                'changed_at' => now(),
            ]);
        }

        $this->logger->log(
            'deleted',
            'promotion',
            $promotion->id,
            'Promotion supprimée sur le service '.($service?->name ?? '?'),
        );

        return response()->json(null, 204);
    }

    /**
     * Trace dans price_history le prix effectif appliqué au service pendant la promotion.
     */
    private function recordPriceHistory(Promotion $promotion): void
    {
        $service = $promotion->service;
        if (! $service) {
            return;
        }

        PriceHistory::create([
            'service_id' => $service->id,
            'price' => $promotion->effectivePrice((float) $service->price) ?? $service->price,
            'changed_at' => $promotion->start_date,
        ]);
    }

    /**
     * Créer une promotion sur une formation.
     */
    public function storeForFormation(Request $request, Course $course): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|string|in:amount,percent',
            'promo_price' => 'required_if:type,amount|nullable|numeric|min:0',
            'discount_percent' => 'required_if:type,percent|nullable|numeric|min:0|max:100',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $validated['formation_id'] = $course->id;

        $promotion = Promotion::create($validated);

        $this->logger->log(
            'created',
            'promotion',
            $promotion->id,
            "Promotion créée sur la formation {$course->name}"
                .($promotion->type === 'percent'
                    ? " ({$promotion->discount_percent}%)"
                    : " ({$promotion->promo_price} FCFA)"),
            newValues: $promotion->only(['type', 'promo_price', 'discount_percent', 'start_date', 'end_date']),
        );

        return (new PromotionResource($promotion->load('formation')))
            ->response()
            ->setStatusCode(201);
    }
}
