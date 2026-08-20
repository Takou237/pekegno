<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CountryResource;
use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class CountryController extends Controller
{
    private function defaultOrganizationId(): ?string
    {
        return Organization::query()->orderBy('created_at')->value('id');
    }

    #[OA\Get(
        path: '/api/countries',
        summary: 'Lister les pays avec pagination, recherche et filtres',
        tags: ['Organisation - Pays'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des pays'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Country::query()
            ->withCount(['cities', 'agencies'])
            ->when($request->input('search'), function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('iso_code', 'like', "%{$search}%");
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

        return CountryResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/countries',
        summary: 'Créer un pays',
        tags: ['Organisation - Pays'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Pays créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:10', 'unique:countries,code'],
            'iso_code' => ['nullable', 'string', 'max:3', 'unique:countries,iso_code'],
            'phone_code' => ['nullable', 'string', 'max:10'],
            'currency_code' => ['required', 'string', 'max:10'],
            'is_active' => ['boolean'],
            'organization_id' => ['nullable', 'string', 'exists:organizations,id'],
        ], [
            'name.required' => 'Le nom du pays est obligatoire.',
            'code.required' => 'Le code du pays est obligatoire.',
            'code.unique' => 'Ce code de pays est déjà utilisé.',
            'iso_code.unique' => 'Ce code ISO est déjà utilisé.',
            'currency_code.required' => 'Le code monétaire est obligatoire.',
        ]);

        $data['organization_id'] ??= $this->defaultOrganizationId();
        $data['is_active'] = $data['is_active'] ?? true;

        $country = Country::create($data);

        return (new CountryResource($country))->response()->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/countries/{country}',
        summary: 'Afficher un pays avec ses villes et agences',
        tags: ['Organisation - Pays'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Pays'),
        ]
    )]
    public function show(Country $country): CountryResource
    {
        $country->load(['organization', 'cities', 'agencies']);

        return new CountryResource($country);
    }

    #[OA\Put(
        path: '/api/countries/{country}',
        summary: 'Modifier un pays',
        tags: ['Organisation - Pays'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Pays modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(Request $request, Country $country): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'code' => ['sometimes', 'string', 'max:10', Rule::unique('countries', 'code')->ignore($country->id)],
            'iso_code' => ['nullable', 'string', 'max:3', Rule::unique('countries', 'iso_code')->ignore($country->id)],
            'phone_code' => ['nullable', 'string', 'max:10'],
            'currency_code' => ['sometimes', 'string', 'max:10'],
            'is_active' => ['boolean'],
            'organization_id' => ['nullable', 'string', 'exists:organizations,id'],
        ], [
            'code.unique' => 'Ce code de pays est déjà utilisé.',
            'iso_code.unique' => 'Ce code ISO est déjà utilisé.',
        ]);

        $country->update($data);

        return (new CountryResource($country->loadCount('cities', 'agencies')))->response();
    }

    #[OA\Delete(
        path: '/api/countries/{country}',
        summary: 'Supprimer un pays',
        tags: ['Organisation - Pays'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Pays supprimé'),
            new OA\Response(response: 422, description: 'Pays non vide'),
        ]
    )]
    public function destroy(Country $country): JsonResponse
    {
        if ($country->agencies()->exists() || $country->cities()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer un pays qui possède encore des villes ou des agences.',
            ], 422);
        }

        $country->delete();

        return response()->json(null, 204);
    }
}