<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreServiceRequest;
use App\Http\Requests\Api\UpdateServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Agency;
use App\Models\PriceHistory;
use App\Models\SeminarTier;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class ServiceController extends Controller
{
    private const ALLOWED_WITH = ['category', 'agency', 'promotions', 'priceHistory', 'seminarTiers'];

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

    #[OA\Get(
        path: '/api/services',
        summary: 'Lister les services avec pagination, recherche et filtres',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'category_id', in: 'query', description: 'Filtrer par catégorie', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Filtrer par agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'price', 'created_at'], default: 'name')),
            new OA\Parameter(name: 'sort_order', in: 'query', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
            new OA\Parameter(name: 'is_seminar', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'type', in: 'query', schema: new OA\Schema(type: 'string', enum: ['service', 'product', 'formation', 'seminar'])),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginǸe des services'),
            new OA\Response(response: 403, description: 'Non autorisǸ'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $defaultWith = ['category', 'agency', 'promotions', 'seminarTiers'];

        $query = Service::with(array_merge($defaultWith, $this->parseWith($request)))
            ->search($request->input('search'))
            ->when($request->category_id, fn ($q, $v) => $q->where('category_id', $v))
            ->when($request->agency_id, fn ($q, $v) => $q->availableIn($v))
            ->when($request->filled('is_seminar'), fn ($q) => $q->where('is_seminar', $request->boolean('is_seminar')))
            ->when($request->filled('type'), function ($q) use ($request) {
                $type = $request->input('type');
                if ($type === 'formation' || $type === 'seminar') {
                    $q->where('is_seminar', true);
                } elseif ($type === 'service' || $type === 'product') {
                    $q->where('is_seminar', false);
                }
            });

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
        summary: 'Créer un service',
        tags: ['Services'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'category_id', 'price'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Conseil en organisation'),
                    new OA\Property(property: 'category_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'price', type: 'number', example: 50000),
                    new OA\Property(property: 'cover_image', type: 'string'),
                    new OA\Property(property: 'presentation_video', type: 'string'),
                    new OA\Property(property: 'target_country_ids', type: 'array', items: new OA\Items(type: 'string', format: 'uuid'), description: 'Crée aussi le service dans toutes les agences de ces pays'),
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
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['target_country_ids']);

        // Agences cibles : l'agence de la page (si fournie), plus toutes les agences
        // des pays cochés (une copie du service par agence, comme les formations).
        $agencyIds = collect([$data['agency_id'] ?? null])
            ->merge($targetCountryIds
                ? Agency::query()->whereNull('deleted_at')->whereIn('country_id', $targetCountryIds)->pluck('id')
                : [])
            ->filter()
            ->unique()
            ->values();

        if ($agencyIds->isEmpty()) {
            throw ValidationException::withMessages([
                'target_country_ids' => 'Aucune agence dans les pays cochés : le service ne peut être créé nulle part.',
            ]);
        }

        $service = DB::transaction(function () use ($data, $agencyIds) {
            $primary = null;

            foreach ($agencyIds as $agencyId) {
                $row = Arr::except($data, ['tiers']);
                $row['agency_id'] = $agencyId;
                // Le code saisi n'est gardé que pour l'agence choisie (il est unique).
                if ($primary !== null || empty($row['code'])) {
                    $row['code'] = Service::generateCode();
                }

                $created = Service::create($row);

                PriceHistory::create([
                    'service_id' => $created->id,
                    'price' => $created->price,
                    'changed_at' => now(),
                ]);

                $this->syncSeminarTiers($created, $data['tiers'] ?? null, (bool) ($data['is_seminar'] ?? false));

                $primary ??= $created;
            }

            return $primary;
        });

        return (new ServiceResource($service->load(['category', 'agency', 'promotions', 'seminarTiers'])))
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
            ['category', 'agency', 'promotions', 'priceHistory'],
            $this->parseWith($request)
        ));

        return new ServiceResource($service->load($with));
    }

    #[OA\Get(
        path: '/api/services/{service}/deployments',
        summary: 'Pays où ce service est déployé (copies du même nom dans les agences)',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'service', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Identifiants des pays déployés'),
            new OA\Response(response: 404, description: 'Service non trouvé'),
        ]
    )]
    public function deployments(Service $service): JsonResponse
    {
        $this->authorize('view', $service);

        return response()->json(['country_ids' => $this->deployedCountryIds($service, (string) $service->name)]);
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
        $oldPrice = $service->price;
        $oldName = (string) $service->name;
        $data = $request->validated();
        // Clé présente (même vide) ⇒ synchroniser le déploiement : créer les
        // copies manquantes dans les pays cochés, supprimer celles des pays
        // décochés. Clé absente ⇒ ne toucher qu'à la fiche actuelle.
        $syncDeploy = $request->exists('target_country_ids');
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['target_country_ids']);

        $service->update(Arr::except($data, ['tiers']));

        if ($request->filled('price') && (string) $request->input('price') !== (string) $oldPrice) {
            PriceHistory::create([
                'service_id' => $service->id,
                'price' => $service->fresh()->price,
                'changed_at' => now(),
            ]);
        }

        $this->syncSeminarTiers($service, $data['tiers'] ?? null, (bool) ($data['is_seminar'] ?? $service->is_seminar));

        if ($syncDeploy) {
            $this->syncDeployment($service->fresh()->load('seminarTiers'), $oldName, $targetCountryIds);
        }

        return new ServiceResource($service->fresh()->load([
            'category', 'agency', 'promotions', 'priceHistory', 'seminarTiers',
        ]));
    }

    /**
     * Pays où des copies du même nom existent (agences non supprimées).
     *
     * @return \Illuminate\Support\Collection<int, string>
     */
    private function deployedCountryIds(Service $service, string $name)
    {
        return Agency::query()
            ->whereNull('agencies.deleted_at')
            ->whereIn('agencies.id', function ($q) use ($name) {
                $q->select('agency_id')->from('services')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->whereNull('deleted_at');
            })
            ->pluck('agencies.country_id')
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * Synchronise le déploiement multi-pays d'un service :
     * - pays cochés : crée la copie manquante (mêmes champs + passes) ;
     * - pays décochés : supprime (soft delete, réversible) les copies sœurs —
     *   la fiche actuelle et son agence ne sont jamais touchées.
     */
    private function syncDeployment(Service $source, string $oldName, array $targetCountryIds): void
    {
        $names = collect([$oldName, (string) $source->name])
            ->map(fn ($n) => mb_strtolower($n))->unique()->values()->all();
        $newNameLower = mb_strtolower((string) $source->name);

        DB::transaction(function () use ($source, $names, $newNameLower, $targetCountryIds) {
            $checkedAgencyIds = Agency::query()
                ->whereNull('deleted_at')
                ->when(! empty($targetCountryIds), fn ($q) => $q->whereIn('country_id', $targetCountryIds), fn ($q) => $q->whereRaw('1 = 0'))
                ->when($source->agency_id, fn ($q, $id) => $q->where('id', '<>', $id))
                ->pluck('id');

            foreach ($checkedAgencyIds as $agencyId) {
                $exists = Service::query()
                    ->where('agency_id', $agencyId)
                    ->whereRaw('LOWER(name) = ?', [$newNameLower])
                    ->exists();
                if ($exists) {
                    continue;
                }

                $row = $source->only([
                    'category_id', 'name', 'description', 'price', 'bonus_fixed',
                    'commission_type', 'commission_value',
                    'is_seminar', 'is_public', 'cover_image', 'presentation_video',
                ]);
                $row['agency_id'] = $agencyId;
                $row['code'] = Service::generateCode();

                $copy = Service::create($row);

                PriceHistory::create([
                    'service_id' => $copy->id,
                    'price' => $copy->price,
                    'changed_at' => now(),
                ]);

                foreach ($source->seminarTiers as $tier) {
                    SeminarTier::create([
                        'service_id' => $copy->id,
                        'tier' => $tier->tier,
                        'label' => $tier->label,
                        'price' => $tier->price,
                        'description' => $tier->description,
                    ]);
                }
            }

            // Copies sœurs hors agence actuelle, dans un pays non coché
            // (liste vide ⇒ tous les pays sont décochés ⇒ tout est supprimé).
            $placeholders = implode(',', array_fill(0, count($names), '?'));
            $staleIds = Service::query()
                ->whereNotNull('agency_id')
                ->when($source->agency_id, fn ($q, $id) => $q->where('agency_id', '<>', $id))
                ->whereRaw("LOWER(name) IN ({$placeholders})", $names)
                ->whereHas('agency', fn ($q) => $q
                    ->when(! empty($targetCountryIds), fn ($qq) => $qq->whereNotIn('country_id', $targetCountryIds)))
                ->pluck('id');

            if ($staleIds->isNotEmpty()) {
                Service::whereIn('id', $staleIds)->delete();
            }
        });
    }

    /**
     * Gère les passes d'un service séminaire.
     *
     * - Service non séminaire : aucun pass (les éventuels passes sont retirés).
     * - Service séminaire sans passes fournis : prix dérivés du prix de base
     *   (Classique = prix, Premium = ×1.5, VIP = ×2.5) — règle « intelligente ».
     * - Passes fournis : remplacés tels quels (modifiables).
     */
    private function syncSeminarTiers(Service $service, ?array $tiers, bool $isSeminar): void
    {
        if (! $isSeminar) {
            if ($service->seminarTiers()->exists()) {
                $service->seminarTiers()->delete();
            }

            return;
        }

        $rows = $tiers
            ? $tiers
            : [
                ['tier' => 'classique', 'label' => 'Pass Classique', 'price' => (float) $service->price],
                ['tier' => 'premium', 'label' => 'Pass Premium', 'price' => round((float) $service->price * 1.5, 2)],
                ['tier' => 'vip', 'label' => 'Pass VIP', 'price' => round((float) $service->price * 2.5, 2)],
            ];

        $service->seminarTiers()->delete();

        foreach ($rows as $row) {
            SeminarTier::create([
                'service_id' => $service->id,
                'tier' => $row['tier'],
                'label' => $row['label'],
                'price' => $row['price'],
                'description' => $row['description'] ?? null,
            ]);
        }
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
            ->with(['category', 'agency'])
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('agency_id', $agencyId))
            ->search($request->input('search'))
            ->orderBy('deleted_at', 'desc');

        $perPage = min((int) $request->input('per_page', 15), 100);

        return ServiceResource::collection($query->paginate($perPage));
    }

    #[OA\Get(
        path: '/api/services/search',
        summary: 'Autocomplétion de services (prix effectif renvoyé)',
        tags: ['Services'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'q', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Résultats'),
        ]
    )]
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q'));

        $services = Service::with(['category', 'seminarTiers'])
            ->when($q, fn ($query) => $query->search($q))
            ->when($request->agency_id, fn ($query, $agencyId) => $query->availableIn($agencyId))
            ->limit(10)
            ->get()
            ->map(fn (Service $service) => [
                'id' => $service->id,
                'name' => $service->name,
                'price' => $service->price,
                'effective_price' => $service->effective_price,
                'has_promotion' => $service->activePromotion() !== null,
                'category' => $service->category?->name,
                'is_seminar' => $service->is_seminar,
                'seminar_tiers' => $service->seminarTiers->map(fn ($tier) => [
                    'tier' => $tier->tier,
                    'label' => $tier->label,
                    'price' => $tier->price,
                    'description' => $tier->description,
                ]),
            ]);

        return response()->json($services);
    }

    public function restore(string $id): ServiceResource
    {
        $this->authorize('restore', Service::class);

        $service = Service::onlyTrashed()->findOrFail($id);
        $service->restore();

        return new ServiceResource($service->load(['category', 'agency', 'promotions']));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Service::class);

        $service = Service::onlyTrashed()->findOrFail($id);
        $service->forceDelete();

        return response()->json(null, 204);
    }
}
