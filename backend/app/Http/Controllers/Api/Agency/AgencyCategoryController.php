<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\AgencyCategory;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Catégories Agency (D2) : packages et prestations. */
class AgencyCategoryController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    public function index(Request $request): JsonResponse
    {
        $categories = AgencyCategory::query()
            ->when($request->kind, fn ($q, $kind) => $q->where('kind', $kind))
            ->when($request->department_id, fn ($q, $id) => $q->where(fn ($w) => $w->where('department_id', $id)->orWhereNull('department_id')))
            // Filtres « vue pays / vue agence » (catalogue Agency) : les catégories
            // globales (sans département) restent visibles partout.
            ->when($request->agency_id, fn ($q, $id) => $q->where(fn ($w) => $w->whereHas('department', fn ($d) => $d->where('agency_id', $id))->orWhereNull('department_id')))
            ->when($request->country_id, fn ($q, $id) => $q->where(fn ($w) => $w->whereHas('department', fn ($d) => $d->whereHas('agency', fn ($a) => $a->where('country_id', $id)))->orWhereNull('department_id')))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->withCount(['packages', 'prestations'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $category = AgencyCategory::create($data);

        $this->logger->log(
            action: 'created',
            entityType: 'agency-category',
            entityId: $category->id,
            description: "Catégorie Agency « {$category->name} » ({$category->kind}) créée",
            request: $request,
        );

        return response()->json($category, 201);
    }

    public function update(Request $request, AgencyCategory $category): JsonResponse
    {
        $data = $this->validated($request, update: true);

        $category->update($data);

        $this->logger->log(
            action: 'updated',
            entityType: 'agency-category',
            entityId: $category->id,
            description: "Catégorie Agency « {$category->name} » modifiée",
            newValues: $data,
            request: $request,
        );

        return response()->json($category->fresh());
    }

    public function destroy(Request $request, AgencyCategory $category): JsonResponse
    {
        $category->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'agency-category',
            entityId: $category->id,
            description: "Catégorie Agency « {$category->name} » supprimée",
            request: $request,
        );

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return $request->validate([
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'kind' => [$required, Rule::in(AgencyCategory::KINDS)],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'string', 'max:20'],
            'icon' => ['nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
    }
}
