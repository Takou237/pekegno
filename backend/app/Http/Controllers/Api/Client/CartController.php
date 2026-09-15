<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\Service;
use App\Services\ActivityLogger;
use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class CartController extends Controller
{
    public function __construct(
        private readonly CartService $cart,
        private readonly ActivityLogger $logger,
    ) {}

    /**
     * Obtient le panier du client connecté avec les articles et leur prix serveur.
     */
    #[OA\Get(
        path: '/api/client/cart',
        summary: 'Obtenir le panier du client connecté',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Panier avec articles et totaux'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $cart = $this->cart->getOrCreate($request->user()->id);

        return response()->json($this->cart->payload($cart));
    }

    /**
     * Synchronise le panier complet (remplacement atomique des articles).
     * Chaque ligne catalogue est revalidée côté serveur (prix officiel, disponibilité).
     */
    #[OA\Put(
        path: '/api/client/cart',
        summary: 'Synchroniser le panier complet',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'application/json',
                schema: new OA\Schema(
                    properties: [
                        new OA\Property(property: 'agency_id', type: 'string', format: 'uuid', nullable: true),
                        new OA\Property(
                            property: 'items',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'service_id', type: 'string', format: 'uuid', nullable: true),
                                    new OA\Property(property: 'product_id', type: 'string', format: 'uuid', nullable: true),
                                    new OA\Property(property: 'quantity', type: 'integer', minimum: 1, maximum: 99),
                                ]
                            )
                        ),
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Panier synchronisé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'items' => ['nullable', 'array', 'max:50'],
            'items.*.service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'items.*.product_id' => ['nullable', 'uuid', 'exists:products,id'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:99'],
        ]);

        foreach ($validated['items'] ?? [] as $line) {
            if (empty($line['service_id']) && empty($line['product_id'])) {
                throw ValidationException::withMessages(['items' => 'Chaque ligne doit référencer un service ou un produit.']);
            }
        }

        $cart = $this->cart->getOrCreate($request->user()->id);

        $cart->items()->delete();
        foreach ($validated['items'] ?? [] as $line) {
            $cart->items()->create([
                'service_id' => $line['service_id'] ?? null,
                'product_id' => $line['product_id'] ?? null,
                'quantity' => (int) ($line['quantity'] ?? 1),
            ]);
        }
        $cart->update(['agency_id' => $validated['agency_id'] ?? null]);

        $this->logger->log(
            action: 'cart_synced',
            entityType: 'cart',
            entityId: $cart->id,
            description: 'Panier synchronisé ('.count($validated['items'] ?? []).' article(s))',
            request: $request,
        );

        return response()->json($this->cart->payload($cart->fresh()));
    }

    /**
     * Ajoute un article au panier (fusionne les quantités si l'article existe déjà).
     */
    #[OA\Post(
        path: '/api/client/cart/items',
        summary: 'Ajouter un article au panier',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'application/json',
                schema: new OA\Schema(
                    properties: [
                        new OA\Property(property: 'service_id', type: 'string', format: 'uuid', nullable: true),
                        new OA\Property(property: 'product_id', type: 'string', format: 'uuid', nullable: true),
                        new OA\Property(property: 'quantity', type: 'integer', minimum: 1, maximum: 99),
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Article ajouté'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'product_id' => ['nullable', 'uuid', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:99'],
        ]);

        if (empty($validated['service_id']) && empty($validated['product_id'])) {
            throw ValidationException::withMessages(['service_id' => 'Veuillez fournir un service ou un produit.']);
        }

        $cart = $this->cart->getOrCreate($request->user()->id);

        $existing = $cart->items()
            ->where(fn ($q) => with($validated, fn ($v) => $q->when($v['service_id'] ?? null, fn ($qq) => $qq->where('service_id', $v['service_id']))->when($v['product_id'] ?? null, fn ($qq) => $qq->where('product_id', $v['product_id']))))
            ->first();

        $quantity = (int) ($validated['quantity'] ?? 1);

        if ($existing) {
            $existing->update(['quantity' => min(99, $existing->quantity + $quantity)]);
        } else {
            $cart->items()->create([
                'service_id' => $validated['service_id'] ?? null,
                'product_id' => $validated['product_id'] ?? null,
                'quantity' => $quantity,
            ]);
        }

        return response()->json($this->cart->payload($cart->fresh()), 201);
    }

    /**
     * Modifie la quantité d'un article du panier.
     */
    #[OA\Put(
        path: '/api/client/cart/items/{item}',
        summary: 'Modifier la quantité d\'un article du panier',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'item', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'application/json',
                schema: new OA\Schema(properties: [new OA\Property(property: 'quantity', type: 'integer', minimum: 1, maximum: 99)])
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Quantité mise à jour'),
            new OA\Response(response: 404, description: 'Article introuvable'),
        ]
    )]
    public function updateItem(Request $request, CartItem $item): JsonResponse
    {
        abort_unless($item->cart->user_id === $request->user()->id, 404, 'Article introuvable.');

        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        $item->update(['quantity' => $validated['quantity']]);

        return response()->json($this->cart->payload($item->cart->fresh()));
    }

    /**
     * Retire un article du panier.
     */
    #[OA\Delete(
        path: '/api/client/cart/items/{item}',
        summary: 'Retirer un article du panier',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'item', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Article retiré'),
            new OA\Response(response: 404, description: 'Article introuvable'),
        ]
    )]
    public function removeItem(Request $request, CartItem $item): JsonResponse
    {
        abort_unless($item->cart->user_id === $request->user()->id, 404, 'Article introuvable.');

        $item->delete();

        return response()->json($this->cart->payload($item->cart->fresh()));
    }

    /**
     * Vide entièrement le panier.
     */
    #[OA\Delete(
        path: '/api/client/cart',
        summary: 'Vider le panier',
        tags: ['Espace client'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Panier vidé'),
        ]
    )]
    public function clear(Request $request): JsonResponse
    {
        $cart = $this->cart->getOrCreate($request->user()->id);
        $cart->items()->delete();
        $cart->update(['agency_id' => null]);

        return response()->json($this->cart->payload($cart->fresh()));
    }
}