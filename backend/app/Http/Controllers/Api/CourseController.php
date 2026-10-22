<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCourseRequest;
use App\Http\Requests\Api\UpdateCourseRequest;
use App\Http\Resources\CourseResource;
use App\Models\Agency;
use App\Models\Course;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use OpenApi\Attributes as OA;

class CourseController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
    ) {}

    /**
     * Réduit la requête au périmètre organisationnel : cours globaux
     * (agency_id null) + cours des agences autorisées.
     */
    private function scopeQuery(Request $request, $query)
    {
        // Choix explicite d'une agence (vente/inscription inter-pays) : on fait
        // confiance à ce filtre et on ne borne plus au périmètre de l'utilisateur,
        // sinon un commercial ne verrait aucune formation de l'agence choisie.
        if ($request->filled('agency_id')) {
            return $query;
        }

        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds === null) {
            return $query;
        }

        return $query->where(function ($q) use ($agencyIds) {
            $q->whereNull('agency_id')->orWhereIn('agency_id', $agencyIds);
        });
    }

    #[OA\Get(
        path: '/api/courses',
        summary: 'Lister les cours avec pagination, recherche et filtres',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom, code ou description', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'mode', in: 'query', schema: new OA\Schema(type: 'string', enum: ['online', 'in_person', 'mixed'])),
            new OA\Parameter(name: 'categories', in: 'query', description: 'Filtrer par catégories (un ou plusieurs ids)', schema: new OA\Schema(type: 'array', items: new OA\Schema(type: 'string', format: 'uuid'))),
            new OA\Parameter(name: 'promotion', in: 'query', description: 'Filtre promotion : "active" (promotion en cours) ou "none" (aucune promotion en cours)', schema: new OA\Schema(type: 'string', enum: ['active', 'none'])),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Disponibilité : cours de l\'agence + cours globaux', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', description: 'Pays : cours des agences du pays + cours globaux', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'sort_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['name', 'price', 'created_at'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des cours'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Course::with(['agency', 'categories', 'promotions'])
            ->withCount(['sessions', 'modules', 'formationEnrollments' => fn ($q) => $q->whereNot('status', 'cancelled')])
            ->search($request->input('search'))
            ->when($request->mode, fn ($q, $v) => $q->where('mode', $v))
            ->when($request->filled('categories'), function ($q) use ($request) {
                $q->whereHas('categories', fn ($cq) => $cq->whereIn('course_categories.id', (array) $request->input('categories')));
            })
            ->when($request->promotion, function ($q, $v) {
                $now = now();
                if ($v === 'active') {
                    $q->whereHas('promotions', fn ($pq) => $pq->where('start_date', '<=', $now)->whereDate('end_date', '>=', $now->toDateString()));
                } elseif ($v === 'none') {
                    $q->whereDoesntHave('promotions', fn ($pq) => $pq->where('start_date', '<=', $now)->whereDate('end_date', '>=', $now->toDateString()));
                }
            })
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->agency_id, fn ($q, $v) => $q->availableIn($v))
            ->when($request->country_id, function ($q, $v) {
                $q->where(fn ($cq) => $cq->whereNull('agency_id')
                    ->orWhereHas('agency', fn ($a) => $a->where('country_id', $v)));
            });

        $this->scopeQuery($request, $query);

        $sortBy = in_array($request->input('sort_by'), ['name', 'price', 'duration_hours', 'created_at'], true)
            ? $request->input('sort_by')
            : 'name';
        $sortOrder = $request->input('sort_order', 'asc') === 'desc' ? 'desc' : 'asc';

        return CourseResource::collection(
            $query->orderBy($sortBy, $sortOrder)
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/courses',
        summary: 'Créer un cours (code auto-généré si absent)',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Cours créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function store(StoreCourseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $categoryIds = $data['category_ids'] ?? [];
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['category_ids'], $data['target_country_ids']);

        // Agences cibles : toutes les agences des pays sélectionnés,
        // plus l'agence courante (toujours maintenue, même si non dans la liste).
        $agencyIds = Agency::query()
            ->whereNull('deleted_at')
            ->when(
                $targetCountryIds,
                fn ($q) => $q->whereIn('country_id', $targetCountryIds),
                fn ($q) => $q->whereRaw('1 = 0'),
            )
            ->pluck('id')
            ->push($data['agency_id'] ?? null)
            ->filter()
            ->unique()
            ->values();

        // Cours global (ni pays cible, ni agence précisée) : garder le comportement
        // d'origine (une seule formation, agency_id null), sinon la liste d'agences
        // est vide et la création plante (aucune formation créée).
        if ($agencyIds->isEmpty()) {
            $agencyIds = collect([$data['agency_id'] ?? null]);
        }

        $created = collect();
        $primary = null;

        foreach ($agencyIds as $agencyId) {
            $row = $data;
            $row['code'] = Course::generateCode();
            $row['agency_id'] = $agencyId;

            $course = Course::create($row);

            if (! empty($categoryIds)) {
                $course->categories()->sync($categoryIds);
            }

            $created->push($course);
            if ($primary === null && ! empty($data['agency_id']) && $agencyId === $data['agency_id']) {
                $primary = $course;
            }
        }

        $primary ??= $created->first();

        return (new CourseResource($primary->load(['agency', 'categories'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/courses/{course}',
        summary: 'Afficher un cours',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du cours'),
            new OA\Response(response: 404, description: 'Cours non trouvé'),
        ]
    )]
    public function show(Course $course): CourseResource
    {
        return new CourseResource($course->load(['agency', 'categories', 'modules.trainer', 'sessions']));
    }

    #[OA\Get(
        path: '/api/courses/{course}/deployments',
        summary: 'Pays où cette formation est déployée (copies du même nom dans les agences)',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Identifiants des pays déployés'),
            new OA\Response(response: 404, description: 'Cours non trouvé'),
        ]
    )]
    public function deployments(Course $course): JsonResponse
    {
        $countryIds = Agency::query()
            ->whereNull('agencies.deleted_at')
            ->whereIn('agencies.id', function ($q) use ($course) {
                $q->select('agency_id')->from('courses')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower((string) $course->name)])
                    ->whereNull('deleted_at');
            })
            ->pluck('agencies.country_id')
            ->filter()
            ->unique()
            ->values();

        return response()->json(['country_ids' => $countryIds]);
    }

    #[OA\Put(
        path: '/api/courses/{course}',
        summary: 'Modifier un cours',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Cours modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function update(UpdateCourseRequest $request, Course $course): CourseResource
    {
        $data = $request->validated();
        $categoryIds = $data['category_ids'] ?? null;
        // Clé présente (même vide) ⇒ synchroniser le déploiement : créer les
        // copies manquantes dans les pays cochés, supprimer celles des pays
        // décochés. Clé absente ⇒ ne toucher qu'à la fiche actuelle.
        $syncDeploy = $request->exists('target_country_ids');
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['category_ids'], $data['target_country_ids']);
        $oldName = (string) $course->name;

        $course->update($data);

        if ($categoryIds !== null) {
            $course->categories()->sync($categoryIds);
        }

        if ($syncDeploy) {
            $this->syncDeployment($course->fresh()->load('categories'), $oldName, $targetCountryIds);
        }

        return new CourseResource($course->fresh()->load(['agency', 'categories']));
    }

    /**
     * Synchronise le déploiement multi-pays d'une formation :
     * - pays cochés : crée la copie manquante (mêmes champs + catégories) ;
     * - pays décochés : supprime (soft delete, réversible) les copies sœurs —
     *   la fiche actuelle et son agence ne sont jamais touchées.
     */
    private function syncDeployment(Course $source, string $oldName, array $targetCountryIds): void
    {
        $names = collect([$oldName, (string) $source->name])
            ->map(fn ($n) => mb_strtolower($n))->unique()->values()->all();
        $newNameLower = mb_strtolower((string) $source->name);
        $sourceCategoryIds = $source->categories->pluck('id')->all();

        $checkedAgencyIds = Agency::query()
            ->whereNull('deleted_at')
            ->when(! empty($targetCountryIds), fn ($q) => $q->whereIn('country_id', $targetCountryIds), fn ($q) => $q->whereRaw('1 = 0'))
            ->when($source->agency_id, fn ($q, $id) => $q->where('id', '<>', $id))
            ->pluck('id');

        foreach ($checkedAgencyIds as $agencyId) {
            $exists = Course::query()
                ->where('agency_id', $agencyId)
                ->whereRaw('LOWER(name) = ?', [$newNameLower])
                ->exists();
            if ($exists) {
                continue;
            }

            $row = $source->only([
                'name', 'description', 'objective', 'prerequisites', 'mode',
                'price', 'duration_hours', 'duration_type', 'duration_months',
                'cover_image', 'presentation_video', 'is_active', 'is_public',
            ]);
            $row['code'] = Course::generateCode();
            $row['agency_id'] = $agencyId;

            $copy = Course::create($row);

            if (! empty($sourceCategoryIds)) {
                $copy->categories()->sync($sourceCategoryIds);
            }
        }

        // Copies sœurs hors agence actuelle, dans un pays non coché
        // (liste vide ⇒ tous les pays sont décochés ⇒ tout est supprimé).
        $placeholders = implode(',', array_fill(0, count($names), '?'));
        $staleIds = Course::query()
            ->whereNotNull('agency_id')
            ->when($source->agency_id, fn ($q, $id) => $q->where('agency_id', '<>', $id))
            ->whereRaw("LOWER(name) IN ({$placeholders})", $names)
            ->whereHas('agency', fn ($q) => $q
                ->when(! empty($targetCountryIds), fn ($qq) => $qq->whereNotIn('country_id', $targetCountryIds)))
            ->pluck('id');

        if ($staleIds->isNotEmpty()) {
            Course::whereIn('id', $staleIds)->delete();
        }
    }

    #[OA\Delete(
        path: '/api/courses/{course}',
        summary: 'Supprimer un cours (soft delete)',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'course', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Cours supprimé'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function destroy(Course $course): JsonResponse
    {
        $course->delete();

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/courses/trash',
        summary: 'Lister les cours supprimés',
        tags: ['Académie — Cours'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des cours supprimés'),
        ]
    )]
    public function trash(Request $request): AnonymousResourceCollection
    {
        $query = Course::onlyTrashed()
            ->with(['categories', 'agency'])
            ->search($request->input('search'));

        $this->scopeQuery($request, $query);

        return CourseResource::collection(
            $query->orderByDesc('deleted_at')
                ->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    public function restore(string $id): CourseResource
    {
        $course = Course::onlyTrashed()->findOrFail($id);
        $course->restore();

        return new CourseResource($course->load(['categories', 'agency']));
    }

    public function forceDelete(string $id): JsonResponse
    {
        $course = Course::onlyTrashed()->findOrFail($id);
        $course->forceDelete();

        return response()->json(null, 204);
    }
}