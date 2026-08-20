<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Organization;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Sélecteur de périmètre organisationnel ($3, $6).
 *
 * Fournit au client la liste des pays / villes / agences accessibles
 * à l'utilisateur courant, ainsi que le fil d'Ariane de la position
 * courante (Groupe → Pays → Ville → Agence).
 */
class ScopeController extends Controller
{
    public function __construct(private readonly ScopeService $scopeService) {}

    #[OA\Get(
        path: '/api/scope/context',
        summary: 'Contexte de périmètre : pays, villes et agences autorisés + fil d\'Ariane',
        tags: ['Organisation - Périmètre'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'country_id', in: 'query', description: 'Restreindre les villes à un pays', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'city_id', in: 'query', description: 'Restreindre les agences à une ville', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Contexte du périmètre'),
            new OA\Response(response: 403, description: 'Hors du périmètre autorisé'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $agencyIds = $this->scopeService->agencyIds($user);
        $countryIds = $this->scopeService->countryIds($user);
        $cityIds = $this->scopeService->cityIds($user);

        $organization = Organization::query()->orderBy('created_at')->first();

        $countries = Country::query()
            ->withCount('cities', 'agencies')
            ->when($countryIds !== null, fn ($q) => $q->whereIn('id', $countryIds))
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (Country $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'currency_code' => $c->currency_code,
                'cities_count' => $c->cities_count,
                'agencies_count' => $c->agencies_count,
            ]);

        $cities = City::query()
            ->withCount('agencies')
            ->when($request->input('country_id'), fn ($q, $id) => $q->where('country_id', $id))
            ->when($countryIds !== null, fn ($q) => $q->whereIn('country_id', $countryIds))
            ->when($cityIds !== null, fn ($q) => $q->whereIn('id', $cityIds))
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (City $c) => [
                'id' => $c->id,
                'country_id' => $c->country_id,
                'name' => $c->name,
                'code' => $c->code,
                'agencies_count' => $c->agencies_count,
            ]);

        $agencies = Agency::query()
            ->when($request->input('city_id'), fn ($q, $id) => $q->where('city_id', $id))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->when($countryIds !== null, fn ($q) => $q->whereIn('country_id', $countryIds))
            ->when($cityIds !== null, fn ($q) => $q->whereIn('city_id', $cityIds))
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'type', 'country_id', 'city_id'])
            ->map(fn (Agency $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'code' => $a->code,
                'type' => $a->type,
                'country_id' => $a->country_id,
                'city_id' => $a->city_id,
            ]);

        $selectedCountry = null;
        $selectedCity = null;

        if ($request->input('city_id')) {
            $selectedCity = City::with('country')->findOrFail($request->input('city_id'));
            $selectedCountry = $selectedCity->country;
        } elseif ($request->input('country_id')) {
            $selectedCountry = Country::findOrFail($request->input('country_id'));
        }

        if ($selectedCountry && $countryIds !== null && ! in_array($selectedCountry->id, $countryIds, true)) {
            abort(403, 'Ce pays est hors de votre périmètre.');
        }

        if ($selectedCity && $cityIds !== null && ! in_array($selectedCity->id, $cityIds, true)) {
            abort(403, 'Cette ville est hors de votre périmètre.');
        }

        return response()->json([
            'scope' => [
                'type' => $this->scopeService->isGlobal($user) ? 'global' : 'restricted',
                'organization' => $organization?->only('id', 'name', 'code'),
                'breadcrumb' => collect([
                    ['type' => 'organization', 'id' => $organization?->id, 'name' => $organization?->name],
                    ['type' => 'country', 'id' => $selectedCountry?->id, 'name' => $selectedCountry?->name],
                    ['type' => 'city', 'id' => $selectedCity?->id, 'name' => $selectedCity?->name],
                ])->filter(fn ($c) => $c['id'] !== null)->values(),
            ],
            'countries' => $countries,
            'cities' => $cities,
            'agencies' => $agencies,
        ]);
    }
}