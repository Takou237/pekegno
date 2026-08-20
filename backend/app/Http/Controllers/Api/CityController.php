<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CityResource;
use App\Models\City;
use App\Models\Country;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class CityController extends Controller
{
    #[OA\Get(
        path: '/api/cities',
        summary: 'Lister les villes avec pagination et filtre par pays',
        tags: ['Organisation - Villes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des villes'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = City::query()
            ->with('country')
            ->withCount('agencies')
            ->when($request->input('country_id'), fn ($q, $id) => $q->where('country_id', $id))
            ->when($request->input('search'), function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->when($request->has('is_active'), function ($q) use ($request) {
                $q->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
            });

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');

        if (in_array($sortBy, ['name', 'code', 'created_at'], true)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        return CityResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/cities',
        summary: 'Créer une ville',
        tags: ['Organisation - Villes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Ville créée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'country_id' => ['required', 'string', 'exists:countries,id'],
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:20'],
            'is_active' => ['boolean'],
        ], [
            'country_id.required' => 'Le pays est obligatoire.',
            'country_id.exists' => "Ce pays n'existe pas.",
            'name.required' => 'Le nom de la ville est obligatoire.',
        ]);

        $data['is_active'] = $data['is_active'] ?? true;

        $exists = City::where('country_id', $data['country_id'])
            ->where('name', $data['name'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Cette ville existe déjà dans ce pays.',
            ], 422);
        }

        $city = City::create($data);

        return (new CityResource($city->load('country')))->response()->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/cities/{city}',
        summary: 'Afficher une ville',
        tags: ['Organisation - Villes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Ville'),
        ]
    )]
    public function show(City $city): CityResource
    {
        return new CityResource($city->load('country', 'agencies'));
    }

    #[OA\Put(
        path: '/api/cities/{city}',
        summary: 'Modifier une ville',
        tags: ['Organisation - Villes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Ville modifiée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(Request $request, City $city): JsonResponse
    {
        $data = $request->validate([
            'country_id' => ['sometimes', 'string', 'exists:countries,id'],
            'name' => ['sometimes', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:20'],
            'is_active' => ['boolean'],
        ]);

        $conflict = City::where('name', $data['name'] ?? $city->name)
            ->where('country_id', $data['country_id'] ?? $city->country_id)
            ->where('id', '!=', $city->id)
            ->exists();

        if ($conflict) {
            return response()->json([
                'message' => 'Cette ville existe déjà dans ce pays.',
            ], 422);
        }

        $city->update($data);

        return (new CityResource($city->load('country', 'agencies')))->response();
    }

    #[OA\Delete(
        path: '/api/cities/{city}',
        summary: 'Supprimer une ville',
        tags: ['Organisation - Villes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Ville supprimée'),
            new OA\Response(response: 422, description: 'Ville non vide'),
        ]
    )]
    public function destroy(City $city): JsonResponse
    {
        if ($city->agencies()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer une ville qui possède encore des agences.',
            ], 422);
        }

        $city->delete();

        return response()->json(null, 204);
    }
}