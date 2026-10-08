<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\AgencyCategory;
use App\Models\Department;
use App\Models\Prestation;
use App\Models\PrestationOffer;
use App\Services\AgencyAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        abort_unless($this->access->canAccessAgency($request->user(), $data['agency_id']), 403, 'Agence hors de votre périmètre.');
        $this->assertScope($data);

        $offer = PrestationOffer::create($data + ['created_by' => $request->user()->id]);

        return response()->json($offer->load(self::RELATIONS), 201);
    }

    public function show(Request $request, PrestationOffer $offer): JsonResponse
    {
        abort_unless($this->access->canAccessOffer($request->user(), $offer->id), 403, 'Offre hors de votre périmètre.');

        $offer->loadCount('subscriptions')
            ->loadAvg('subscriptions as subscriptions_rating_avg', 'rating_avg')
            ->load(self::RELATIONS);

        return response()->json($offer);
    }

    public function update(Request $request, PrestationOffer $offer): JsonResponse
    {
        abort_unless($this->access->canAccessOffer($request->user(), $offer->id), 403, 'Offre hors de votre périmètre.');

        $data = $this->validated($request, update: true);
        unset($data['agency_id']);
        $this->assertScope($data + [
            'agency_id' => $offer->agency_id,
            'department_id' => $offer->department_id,
            'category_id' => $offer->category_id,
        ]);

        $offer->update($data);

        return response()->json($offer->fresh()->load(self::RELATIONS));
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
            'agency_id' => [$required, 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['nullable', 'uuid', Rule::exists('agency_categories', 'id')->whereNull('deleted_at')],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
