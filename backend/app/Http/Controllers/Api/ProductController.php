<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreProductRequest;
use App\Http\Requests\Api\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\Service;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class ProductController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    /**
     * Réduit la requête au périmètre organisationnel : produits globaux
     * (agency_id null) + produits des agences autorisées.
     */
    private function scopeQuery(Request $request, $query)
    {
        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds === null) {
            return $query;
        }

        return $query->where(function ($q) use ($agencyIds) {
            $q->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds);
        });
    }

    #[OA\Get(
        path: '/api/products',
        summary: 'Lister les produits avec pagination, recherche et filtres',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom, SKU, marque ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'category_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Disponibilité : produits de l\'agence + produits globaux', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'brand', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'is_active', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des produits'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::with(['category', 'agency'])
            ->search($request->input('search'))
            ->when($request->category_id, fn ($q, $v) => $q->where('category_id', $v))
            ->when($request->brand, fn ($q, $v) => $q->where('brand', 'like', "%{$v}%"))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->agency_id, fn ($q, $v) => $q->availableIn($v));

        $this->scopeQuery($request, $query);

        $sortBy = in_array($request->input('sort_by'), ['name', 'sku', 'selling_price', 'created_at'], true)
            ? $request->input('sort_by')
            : 'name';
        $sortOrder = $request->input('sort_order', 'asc') === 'desc' ? 'desc' : 'asc';

        return ProductResource::collection(
            $query->orderBy($sortBy, $sortOrder)
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/products',
        summary: 'Créer un produit (SKU auto-généré si absent)',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Produit créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreProductRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['sku'] = $data['sku'] ?? Product::generateSku();

        $product = Product::create($data);

        return (new ProductResource($product->load(['category', 'agency'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/products/{product}',
        summary: 'Afficher un produit',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'product', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du produit'),
            new OA\Response(response: 404, description: 'Produit non trouvé'),
        ]
    )]
    public function show(Product $product): ProductResource
    {
        return new ProductResource($product->load(['category', 'agency']));
    }

    #[OA\Put(
        path: '/api/products/{product}',
        summary: 'Modifier un produit',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'product', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Produit modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateProductRequest $request, Product $product): ProductResource
    {
        $product->update($request->validated());

        return new ProductResource($product->fresh()->load(['category', 'agency']));
    }

    #[OA\Delete(
        path: '/api/products/{product}',
        summary: 'Supprimer un produit (soft delete)',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'product', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Produit supprimé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/products/search',
        summary: 'Autocomplétion de produits par nom/SKU',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'q', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Résultats'),
        ]
    )]
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q'));

        $query = Product::with('category')
            ->when($q, fn ($query) => $query->search($q))
            ->when($request->agency_id, fn ($query, $agencyId) => $query->availableIn($agencyId));

        $this->scopeQuery($request, $query);

        $products = $query->limit(10)->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'brand' => $product->brand,
                'selling_price' => $product->selling_price,
                'price_with_tax' => $product->price_with_tax,
                'category' => $product->category?->name,
                'is_stock_managed' => $product->is_stock_managed,
            ]);

        return response()->json($products);
    }

    #[OA\Get(
        path: '/api/products/trash',
        summary: 'Lister les produits supprimés',
        tags: ['Produits'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des produits supprimés'),
        ]
    )]
    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Product::onlyTrashed()
            ->with(['category', 'agency'])
            ->search($request->input('search'));

        $this->scopeQuery($request, $query);

        return ProductResource::collection(
            $query->orderByDesc('deleted_at')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    public function restore(string $id): ProductResource
    {
        $product = Product::onlyTrashed()->findOrFail($id);
        $product->restore();

        return new ProductResource($product->load(['category', 'agency']));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $product = Product::onlyTrashed()->findOrFail($id);
        $product->forceDelete();

        return response()->json(null, 204);
    }
}