<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Department;
use App\Models\Organization;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Sélecteur de périmètre organisationnel.
 *
 * Fournit au client l'arbre pays → agences → départements (typés)
 * accessibles à l'utilisateur courant.
 */
class ScopeController extends Controller
{
    public function __construct(private readonly ScopeService $scopeService) {}

    #[OA\Get(
        path: '/api/scope/context',
        summary: 'Arbre pays → agences → départements typés du périmètre utilisateur',
        tags: ['Organisation - Périmètre'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'types', in: 'query', description: 'Filtrer les départements par type(s) séparés par virgule', schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Arbre de contexte organisationnel'),
            new OA\Response(response: 403, description: 'Hors du périmètre autorisé'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $agencyIds = $this->scopeService->agencyIds($user);
        $countryIds = $this->scopeService->countryIds($user);

        $organization = Organization::query()->orderBy('created_at')->first();

        // Filtrage optionnel par type(s) de département
        $deptTypeFilter = null;
        if ($request->input('types')) {
            $deptTypeFilter = array_map('trim', explode(',', $request->input('types')));
        }

        // Charger les pays avec leurs agences et départements
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

        // Charger les agences avec départements typés
        $agenciesQuery = Agency::query()
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->when($countryIds !== null, fn ($q) => $q->whereIn('country_id', $countryIds))
            ->whereNull('deleted_at')
            ->with(['departments' => function ($q) use ($deptTypeFilter) {
                $q->orderBy('name');
                if ($deptTypeFilter) {
                    $q->whereIn('type', $deptTypeFilter);
                }
            }])
            ->orderBy('name');

        $agencies = $agenciesQuery->get(['id', 'name', 'code', 'type', 'country_id', 'city_id'])
            ->map(fn (Agency $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'code' => $a->code,
                'country_id' => $a->country_id,
                'city_id' => $a->city_id,
                'departments' => $a->departments->map(fn (Department $d) => [
                    'id' => $d->id,
                    'name' => $d->name,
                    'type' => $d->type,
                ]),
            ]);

        // Construire l'arbre imbriqué : pays → agences
        $countriesWithAgencies = $countries->map(function ($country) use ($agencies) {
            $countryAgencies = $agencies->filter(fn ($a) => $a['country_id'] === $country['id']);
            return array_merge($country, [
                'agencies' => $countryAgencies->values(),
            ]);
        });

        return response()->json([
            'user' => [
                'is_global' => $this->scopeService->isGlobal($user),
                'assignments' => $user->assignments->map(fn ($a) => [
                    'agency_id' => $a->agency_id,
                    'department_id' => $a->department_id,
                    'is_primary' => $a->is_primary,
                ]),
            ],
            'countries' => $countriesWithAgencies,
        ]);
    }
}
