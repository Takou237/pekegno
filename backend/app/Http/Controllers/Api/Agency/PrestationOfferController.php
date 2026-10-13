<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\AgencyCategory;
use App\Models\Department;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Services\AgencyAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Offres de prestation : la fiche « Campagne Facebook » à laquelle les
 * clients souscrivent (§ prestations — 3 niveaux offre → souscription → détail).
 */
class PrestationOfferController extends Controller
{
    private const RELATIONS = [
        'category:id,name,color',
        'agency:id,name',
        'department:id,name',
    ];

    public function __construct(private readonly AgencyAccessService $access) {}

    public function index(Request $request): JsonResponse
    {
        $query = $this->access->scopeOffers(PrestationOffer::query(), $request->user())
            ->with(self::RELATIONS)
            ->withCount('subscriptions')
            ->withAvg('subscriptions as subscriptions_rating_avg', 'rating_avg')
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->country_id, fn ($q, $id) => $q->whereHas('agency', fn ($a) => $a->where('country_id', $id)))
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$s}%")
                ->orWhere('description', 'like', "%{$s}%")));

        $perPage = min((int) $request->input('per_page', 15), 100);

        return response()->json($query->orderBy('name')->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['target_country_ids']);

        $sourceAgencyId = $data['agency_id'] ?? null;
        abort_unless($sourceAgencyId === null || $this->access->canAccessAgency($request->user(), $sourceAgencyId), 403, 'Agence hors de votre périmètre.');

        // Agences cibles : l'agence de la page (si fournie), plus toutes les agences
        // des pays cochés (une copie de l'offre par agence, comme les packages).
        $agencyIds = collect([$sourceAgencyId])
            ->merge($targetCountryIds
                ? Agency::query()->whereNull('deleted_at')->whereIn('country_id', $targetCountryIds)->pluck('id')
                : [])
            ->filter()
            ->unique()
            ->values()
            ->filter(fn (string $agencyId) => $this->access->canAccessAgency($request->user(), $agencyId))
            ->values();

        if ($agencyIds->isEmpty()) {
            throw ValidationException::withMessages([
                'target_country_ids' => 'Aucune agence accessible dans les pays cochés : la prestation ne peut être créée nulle part.',
            ]);
        }

        // Sans agence source, le département / la catégorie ne peuvent pas être
        // validés ici : ils sont réadaptés agence par agence (scopeToAgency).
        if ($sourceAgencyId !== null) {
            $this->assertScope($data);
        }

        $offers = DB::transaction(function () use ($data, $agencyIds, $request) {
            $created = [];

            foreach ($agencyIds as $agencyId) {
                $scoped = $this->scopeToAgency($data, $agencyId);
                // Idempotence : ne pas dupliquer si une offre du même nom existe déjà.
                $exists = PrestationOffer::query()
                    ->where('agency_id', $agencyId)
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($scoped['name'])])
                    ->exists();
                if ($exists) {
                    continue;
                }
                $row = collect($scoped)->except('agency_id')->all();
                $created[] = PrestationOffer::create($row + [
                    'agency_id' => $agencyId,
                    'created_by' => $request->user()->id,
                ]);
            }

            return $created;
        });

        if (empty($offers)) {
            throw ValidationException::withMessages([
                'target_country_ids' => 'Cette prestation existe déjà dans toutes les agences ciblées.',
            ]);
        }

        $primary = collect($offers)->firstWhere('agency_id', $sourceAgencyId) ?? $offers[0];

        return response()->json($primary->load(self::RELATIONS), 201);
    }

    public function show(Request $request, PrestationOffer $offer): JsonResponse
    {
        abort_unless($this->access->canAccessOffer($request->user(), $offer->id), 403, 'Offre hors de votre périmètre.');

        $offer->loadCount('subscriptions')
            ->loadAvg('subscriptions as subscriptions_rating_avg', 'rating_avg')
            ->load(self::RELATIONS);

        return response()->json($offer);
    }

    /**
     * Pays où cette offre est déployée (copies du même nom dans les agences).
     * Sert à pré-cocher le sélecteur de déploiement dans le formulaire.
     */
    public function deployments(Request $request, PrestationOffer $offer): JsonResponse
    {
        abort_unless($this->access->canAccessOffer($request->user(), $offer->id), 403, 'Offre hors de votre périmètre.');

        $countryIds = Agency::query()
            ->whereNull('agencies.deleted_at')
            ->whereIn('agencies.id', function ($q) use ($offer) {
                $q->select('agency_id')->from('prestation_offers')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower((string) $offer->name)])
                    ->whereNull('deleted_at');
            })
            ->pluck('agencies.country_id')
            ->filter()
            ->unique()
            ->values();

        return response()->json(['country_ids' => $countryIds]);
    }

    public function update(Request $request, PrestationOffer $offer): JsonResponse
    {
        abort_unless($this->access->canAccessOffer($request->user(), $offer->id), 403, 'Offre hors de votre périmètre.');

        $data = $this->validated($request, update: true);
        // Clé présente (même vide) ⇒ synchroniser le déploiement : créer les
        // copies manquantes dans les pays cochés, supprimer celles des pays
        // décochés. Clé absente ⇒ ne toucher qu'à la fiche actuelle.
        $syncDeploy = $request->exists('target_country_ids');
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['agency_id'], $data['target_country_ids']);
        $oldName = (string) $offer->name;
        $this->assertScope($data + [
            'agency_id' => $offer->agency_id,
            'department_id' => $data['department_id'] ?? $offer->department_id,
            'category_id' => array_key_exists('category_id', $data) ? $data['category_id'] : $offer->category_id,
        ]);

        $offer->update($data);

        if ($syncDeploy) {
            $this->syncDeployment($request, $offer->fresh(), $oldName, $targetCountryIds);
        }

        return response()->json($offer->fresh()->load(self::RELATIONS));
    }

    /**
     * Synchronise le déploiement multi-pays d'une offre :
     * - pays cochés : crée la copie manquante (même nom / description / statut,
     *   département et catégorie réadaptés à chaque agence) ;
     * - pays décochés : supprime (soft delete, réversible) les copies sœurs,
     *   sauf celles qui ont des souscriptions (conservées pour l'historique) ;
     * - la fiche actuelle et son agence ne sont jamais touchées.
     */
    private function syncDeployment(Request $request, PrestationOffer $source, string $oldName, array $targetCountryIds): void
    {
        $names = collect([$oldName, (string) $source->name])
            ->map(fn ($n) => mb_strtolower($n))->unique()->values()->all();
        $newNameLower = mb_strtolower((string) $source->name);

        $inScope = fn (string $agencyId) => $this->access->canAccessAgency($request->user(), $agencyId);

        DB::transaction(function () use ($request, $source, $names, $newNameLower, $targetCountryIds, $inScope) {
            $checkedAgencyIds = Agency::query()
                ->whereNull('deleted_at')
                ->when(! empty($targetCountryIds), fn ($q) => $q->whereIn('country_id', $targetCountryIds), fn ($q) => $q->whereRaw('1 = 0'))
                ->when($source->agency_id, fn ($q, $id) => $q->where('id', '<>', $id))
                ->pluck('id')
                ->filter($inScope)
                ->values();

            foreach ($checkedAgencyIds as $agencyId) {
                $exists = PrestationOffer::query()
                    ->where('agency_id', $agencyId)
                    ->whereRaw('LOWER(name) = ?', [$newNameLower])
                    ->exists();
                if ($exists) {
                    continue;
                }
                $scoped = $this->scopeToAgency([
                    'department_id' => $source->department_id,
                    'category_id' => $source->category_id,
                    'name' => $source->name,
                    'description' => $source->description,
                    'is_active' => $source->is_active,
                ], $agencyId);
                PrestationOffer::create($scoped + [
                    'agency_id' => $agencyId,
                    'created_by' => $request->user()->id,
                ]);
            }

            // Copies sœurs hors agence actuelle, dans un pays non coché
            // (liste vide ⇒ tous les pays sont décochés ⇒ tout est supprimé).
            $placeholders = implode(',', array_fill(0, count($names), '?'));
            $staleIds = PrestationOffer::query()
                ->whereNotNull('agency_id')
                ->when($source->agency_id, fn ($q, $id) => $q->where('agency_id', '<>', $id))
                ->whereRaw("LOWER(name) IN ({$placeholders})", $names)
                ->whereHas('agency', fn ($q) => $q
                    ->when(! empty($targetCountryIds), fn ($qq) => $qq->whereNotIn('country_id', $targetCountryIds)))
                ->pluck('agency_id', 'id')
                ->filter($inScope)
                ->keys();

            foreach ($staleIds as $staleId) {
                $stale = PrestationOffer::query()->find($staleId);
                // Une offre avec des souscriptions ne peut pas être supprimée :
                // on la conserve (comme pour la suppression manuelle).
                if ($stale === null || Prestation::query()->where('offer_id', $stale->id)->exists()) {
                    continue;
                }
                $stale->delete();
            }
        });
    }

    public function destroy(Request $request, PrestationOffer $offer): JsonResponse
    {
        abort_unless($this->access->canAccessOffer($request->user(), $offer->id), 403, 'Offre hors de votre périmètre.');

        abort_if(
            Prestation::query()->where('offer_id', $offer->id)->exists(),
            422,
            'Une offre avec des souscriptions ne peut pas être supprimée : supprimez d\'abord ses souscriptions.',
        );

        $offer->delete();

        return response()->json(null, 204);
    }

    /** Département / catégorie doivent vivre dans le périmètre de l'offre. */
    private function assertScope(array $data): void
    {
        if (! empty($data['department_id'])) {
            $agencyId = Department::query()->whereKey($data['department_id'])->value('agency_id');
            abort_if($agencyId !== $data['agency_id'], 422, 'Le département n\'appartient pas à cette agence.');
        }

        if (! empty($data['category_id'])) {
            $category = AgencyCategory::query()->find($data['category_id']);
            abort_unless($category !== null, 422, 'Catégorie introuvable.');
            abort_if(
                $category->department_id !== null && $category->department_id !== ($data['department_id'] ?? null),
                422,
                'La catégorie n\'appartient pas à ce département.',
            );
        }
    }

    private function validated(Request $request, bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return $request->validate([
            // L'agence n'est pas obligatoire si des pays cibles sont cochés
            // (l'offre est alors créée dans toutes les agences de ces pays).
            'agency_id' => $update
                ? ['sometimes', 'nullable', 'uuid', 'exists:agencies,id']
                : ['nullable', 'uuid', 'exists:agencies,id', 'required_without:target_country_ids'],
            'target_country_ids' => $update ? ['sometimes', 'nullable', 'array'] : ['nullable', 'array', 'required_without:agency_id'],
            'target_country_ids.*' => ['uuid', 'exists:countries,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['nullable', 'uuid', Rule::exists('agency_categories', 'id')->whereNull('deleted_at')],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
        ], [
            'agency_id.required_without' => 'Cochez au moins un pays où créer la prestation.',
            'target_country_ids.required_without' => 'Cochez au moins un pays où créer la prestation.',
        ]);
    }

    /**
     * Réadapte une offre à l'agence cible : département de l'agence, catégorie
     * (recréée dans ce département si besoin), comme pour les packages.
     */
    private function scopeToAgency(array $data, string $agencyId): array
    {
        $data['department_id'] = $this->resolveDepartment($data['department_id'] ?? null, $agencyId);
        $data['category_id'] = $this->resolveCategory($data['category_id'] ?? null, $data['department_id']);

        return $data;
    }

    /** Département de l'agence cible : celui d'origine s'il lui appartient, sinon le département « agency » de l'agence. */
    private function resolveDepartment(?string $departmentId, string $agencyId): ?string
    {
        if ($departmentId !== null) {
            $department = Department::query()->find($departmentId);

            if ($department !== null && $department->agency_id === $agencyId) {
                return $department->id;
            }
        }

        return Department::query()
            ->where('agency_id', $agencyId)
            ->where('type', Department::TYPE_AGENCY)
            ->orderBy('created_at')
            ->value('id');
    }

    /** Catégorie réutilisée si elle vit dans le département cible, sinon trouvée/créée par nom dans ce département. */
    private function resolveCategory(?string $categoryId, ?string $departmentId): ?string
    {
        if ($categoryId === null) {
            return null;
        }

        $category = AgencyCategory::query()->find($categoryId);

        if ($category === null) {
            return null;
        }

        if ($category->department_id === null || $category->department_id === $departmentId) {
            return $category->id;
        }

        if ($departmentId === null) {
            return null;
        }

        $existing = AgencyCategory::query()
            ->where('department_id', $departmentId)
            ->where('kind', $category->kind)
            ->where('name', $category->name)
            ->first();

        if ($existing !== null) {
            return $existing->id;
        }

        return AgencyCategory::create([
            'department_id' => $departmentId,
            'kind' => $category->kind,
            'name' => $category->name,
            'description' => $category->description,
            'color' => $category->color,
            'icon' => $category->icon,
            'is_active' => $category->is_active,
            'sort_order' => $category->sort_order,
        ])->id;
    }
}
