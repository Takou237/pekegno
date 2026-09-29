<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAgencyRequest;
use App\Http\Requests\Api\UpdateAgencyRequest;
use App\Http\Resources\AgencyResource;
use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Department;
use App\Models\User;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class AgencyController extends Controller
{
    private const ALLOWED_WITH = ['departments', 'assignedUsers', 'activityLogs'];

    public function __construct()
    {
        $this->authorizeResource(Agency::class, 'agency');
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
        path: '/api/agencies',
        summary: 'Lister les agences avec pagination, recherche et filtres',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom, code, email, ville ou pays', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'country', in: 'query', description: 'Filtrer par pays', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', description: 'Nombre de résultats par page', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort_by', in: 'query', description: 'Champ de tri', schema: new OA\Schema(type: 'string', enum: ['name', 'code', 'country', 'created_at'])),
            new OA\Parameter(name: 'sort_order', in: 'query', description: 'Ordre de tri', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'asc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des agences'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Agency::with(array_merge(['departments', 'activities'], $this->parseWith($request)))
            ->withSum(['invoices as revenue' => fn ($q) => $q->where('status', 'paid')->whereNull('cancelled_at')->validated()], 'total_amount')
            ->withSum(['accountingTransactions as expenses' => fn ($q) => $q->where('type', 'expense')], 'amount')
            ->search($request->input('search'))
            ->byCountry($request->input('country'));

        if ($request->filled('type') && in_array($request->input('type'), ['agency', 'academy', 'mixed'], true)) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('country_id')) {
            $query->where('country_id', $request->input('country_id'));
        }

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        if ($agencyIds !== null) {
            $query->whereIn('id', $agencyIds);
        }

        $sortBy = $request->input('sort_by', 'name');
        $sortOrder = $request->input('sort_order', 'asc');
        $allowedSorts = ['name', 'code', 'country', 'created_at'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $agencies = $query->paginate($perPage);

        return AgencyResource::collection($agencies);
    }

    #[OA\Post(
        path: '/api/agencies',
        summary: 'Créer une nouvelle agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['code', 'name', 'country'],
                properties: [
                    new OA\Property(property: 'code', type: 'string', example: 'AG-001'),
                    new OA\Property(property: 'name', type: 'string', example: 'Agence Paris'),
                    new OA\Property(property: 'country', type: 'string', example: 'France'),
                    new OA\Property(property: 'city', type: 'string', example: 'Paris'),
                    new OA\Property(property: 'address', type: 'string', example: '123 Rue de la Paix'),
                    new OA\Property(property: 'phone', type: 'string', example: '+33123456789'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'contact@agence.fr'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Agence créée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreAgencyRequest $request): JsonResponse
    {
        $data = $request->validated();
        $activities = $data['activities'] ?? null;
        unset($data['activities']);

        $data['code'] = Agency::generateNextCode();
        $data['type'] = Agency::deriveType($activities);

        $agency = Agency::create($data);
        $agency->syncActivities($activities);

        return (new AgencyResource($agency->load(['departments', 'activities'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/agencies/{agency}',
        summary: 'Afficher le détail d\'une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'agence', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
        ]
    )]
    public function show(Request $request, Agency $agency): AgencyResource
    {
        $with = array_unique(array_merge(['departments', 'assignedUsers', 'activities'], $this->parseWith($request)));

        return new AgencyResource($agency->load($with));
    }

    #[OA\Put(
        path: '/api/agencies/{agency}',
        summary: 'Modifier une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'code', type: 'string'),
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'country', type: 'string'),
                    new OA\Property(property: 'city', type: 'string'),
                    new OA\Property(property: 'address', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Agence modifiée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateAgencyRequest $request, Agency $agency): AgencyResource
    {
        $data = $request->validated();
        $activities = $data['activities'] ?? null;
        unset($data['activities']);

        if ($activities !== null) {
            $data['type'] = Agency::deriveType($activities);
            $agency->syncActivities($activities);
        }

        $countryChanged = array_key_exists('country_id', $data)
            && $data['country_id'] !== null
            && $data['country_id'] !== $agency->country_id;

        $agency->update($data);

        if ($countryChanged) {
            $this->reassignCountryElements($agency, $data['country_id']);
        }

        return new AgencyResource($agency->fresh()->load(['departments', 'activities']));
    }

    /**
     * Réaffecte au nouveau pays tous les éléments rattachés à l'agence :
     *  - villes rattachées à l'ancien pays qui dépendaient de cette agence ;
     *  - country_id dénormalisé des utilisateurs affectés à l'agence ;
     *  - country_id dénormalisé du journal d'activité.
     *
     * Le reste (factures, commandes, cours, stats...) hérite du pays via
     * l'agence elle-même : rien d'autre à déplacer.
     */
    private function reassignCountryElements(Agency $agency, string $newCountryId): void
    {
        DB::transaction(function () use ($agency, $newCountryId) {
            // La ville rattachée appartient à l'ancien pays : on la détache plutôt
            // que de la déplacer (une ville est une donnée partagée entre agences).
            if ($agency->city_id) {
                $cityCountryId = City::query()->whereKey($agency->city_id)->value('country_id');
                if ($cityCountryId !== null && (string) $cityCountryId !== (string) $newCountryId) {
                    $agency->forceFill(['city_id' => null])->save();
                }
            }

            // Utilisateurs affectés à cette agence (affectation principale d'abord,
            // sinon toute affectation) : ils basculent avec leur agence.
            $agency->assignedUsers()->each(function (User $user) use ($agency, $newCountryId) {
                $hasPrimaryElsewhere = DB::table('user_assignments')
                    ->where('user_id', $user->id)
                    ->where('is_primary', true)
                    ->where('agency_id', '<>', $agency->id)
                    ->exists();

                if ($hasPrimaryElsewhere) {
                    return;
                }

                $user->forceFill(['country_id' => $newCountryId])->save();
            });

            // Clients inscrits dans cette agence : ils changent de pays avec elle
            // (le décompte des clients par pays repose sur users.country_id). Leur
            // ville, qui appartient à l'ancien pays, est détachée.
            User::where('registered_agency_id', $agency->id)
                ->where(fn ($q) => $q->whereNull('country_id')->orWhere('country_id', '<>', $newCountryId))
                ->update([
                    'country_id' => $newCountryId,
                    'city_id' => null,
                    'country' => Country::whereKey($newCountryId)->value('name'),
                ]);

            // Règles de commission ciblant cette agence : leur pays suit.
            DB::table('commission_rules')->where('scope_agency_id', $agency->id)->update(['scope_country_id' => $newCountryId]);

            // Journal d'activité : on dénormalise le nouveau pays.
            $agency->activityLogs()->update(['country_id' => $newCountryId]);
        });
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}',
        summary: 'Supprimer une agence (soft delete)',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Agence supprimée'),
            new OA\Response(response: 409, description: 'Conflit - agence a des dépendances'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Agency $agency): JsonResponse
    {
        $agency->departments->each->delete();
        $agency->assignedUsers()->detach();
        $agency->delete();

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/agencies/trash',
        summary: 'Lister les agences supprimées (corbeille)',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des agences supprimées'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Agency::onlyTrashed()
            ->with(['departments' => fn ($q) => $q->withTrashed()])
            ->search($request->input('search'));

        $perPage = min((int) $request->input('per_page', 15), 100);

        return AgencyResource::collection($query->paginate($perPage));
    }

    #[OA\Post(
        path: '/api/agencies/{agency}/restore',
        summary: 'Restaurer une agence supprimée',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Agence restaurée', content: new OA\JsonContent(ref: '#/components/schemas/Agency')),
            new OA\Response(response: 404, description: 'Agence non trouvée dans la corbeille'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function restore(string $id): AgencyResource
    {
        $this->authorize('restore', Agency::class);

        $agency = Agency::onlyTrashed()->findOrFail($id);
        $agency->load(['departments' => fn ($q) => $q->withTrashed()]);
        $agency->departments->each->restore();
        $agency->restore();

        return new AgencyResource($agency->load('departments'));
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}/force-delete',
        summary: 'Supprimer définitivement une agence',
        tags: ['Agences'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Agence supprimée définitivement'),
            new OA\Response(response: 404, description: 'Agence non trouvée'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function forceDelete(string $id): JsonResponse
    {
        $this->authorize('forceDelete', Agency::class);

        $agency = Agency::onlyTrashed()->findOrFail($id);

        // Garde-fou : certaines FK sont en cascade (commandes, dépenses,
        // contrats...) — supprimer l'agence effacerait silencieusement ses
        // données métier. On refuse tant qu'elles existent.
        $blockingCounts = [
            'invoices' => $agency->invoices()->count(),
            'orders' => DB::table('orders')->where('agency_id', $agency->id)->count(),
            'expenses' => DB::table('expenses')->where('agency_id', $agency->id)->count(),
            'contracts' => DB::table('contracts')->where('agency_id', $agency->id)->count(),
            'opportunities' => DB::table('opportunities')->where('agency_id', $agency->id)->count(),
            'subscriptions' => DB::table('subscriptions')->where('agency_id', $agency->id)->count(),
        ];

        $blocking = array_filter($blockingCounts);
        if ($blocking !== []) {
            $labels = collect([
                'invoices' => 'facture(s)',
                'orders' => 'commande(s)',
                'expenses' => 'dépense(s)',
                'contracts' => 'contrat(s)',
                'opportunities' => 'opportunité(s)',
                'subscriptions' => 'abonnement(s)',
            ])
                ->filter(fn ($_, $table) => isset($blocking[$table]))
                ->map(fn ($label, $table) => "{$blocking[$table]} $label")
                ->implode(', ');

            return response()->json([
                'message' => "Impossible de supprimer définitivement cette agence : {$labels} lui sont encore rattachés.",
            ], 409);
        }

        DB::transaction(function () use ($agency) {
            // Sans events : les observers loggueraient après la suppression des
            // parents (force_deleted...) et créeraient des logs orphelins qui
            // violeraient la FK activity_logs.agency_id.
            Agency::withoutEvents(function () use ($agency) {
                // Départements (y compris ceux en corbeille) et leurs affectations
                $departmentIds = $agency->departments()->withTrashed()->pluck('id');

                if ($departmentIds->isNotEmpty()) {
                    DB::table('user_assignments')->whereIn('department_id', $departmentIds)->delete();
                    DB::table('department_chiefs')->whereIn('department_id', $departmentIds)->delete();
                    Department::withTrashed()->whereIn('id', $departmentIds)->forceDelete();
                }

                // Journal d'activité, lignes de métier, moyens de paiement
                $agency->activityLogs()->delete();
                $agency->activities()->delete();
                $agency->paymentMethods()->delete();

                $agency->assignedUsers()->detach();
                $agency->forceDelete();
            });
        });

        return response()->json(null, 204);
    }
}
