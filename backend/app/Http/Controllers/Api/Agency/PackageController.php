<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\AgencyCategory;
use App\Models\ClientTeamRole;
use App\Models\Department;
use App\Models\Promotion;
use App\Models\Service;
use App\Models\SubscriptionPack;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\AgencyAccessService;
use App\Services\PackageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Packages Agency : catalogue (items, recommandations, promotions) et souscription. */
class PackageController extends Controller
{
    private const RELATIONS = ['category', 'items.service:id,name', 'recommendations.teamRole:id,name', 'promotions', 'agency:id,name'];

    public function __construct(
        private readonly PackageService $packages,
        private readonly AgencyAccessService $access,
        private readonly ActivityLogger $logger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $packages = SubscriptionPack::query()
            ->with(self::RELATIONS)
            ->withCount('contracts')
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->country_id, fn ($q, $id) => $q->whereHas('agency', fn ($a) => $a->where('country_id', $id)))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%"))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $packages]);
    }

    public function show(SubscriptionPack $package): JsonResponse
    {
        return response()->json($package->load(self::RELATIONS)->loadCount('contracts'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $targetCountryIds = $data['target_country_ids'] ?? [];
        unset($data['target_country_ids']);

        $sourceAgencyId = $data['agency_id'] ?? null;
        abort_unless($sourceAgencyId === null || $this->access->canAccessAgency($request->user(), $sourceAgencyId), 403, 'Agence hors de votre périmètre.');

        // Agences cibles : l'agence de la page (si fournie), plus toutes les agences
        // des pays cochés (une copie du package par agence, comme les formations).
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
                'target_country_ids' => 'Aucune agence accessible dans les pays cochés : le package ne peut être créé nulle part.',
            ]);
        }

        $packages = DB::transaction(function () use ($data, $agencyIds) {
            $created = [];

            foreach ($agencyIds as $agencyId) {
                $scoped = $this->scopeToAgency($data, $agencyId);
                $row = collect($scoped)->except(['items', 'recommendations', 'agency_id', 'code'])->all();
                $package = SubscriptionPack::create($row + [
                    'agency_id' => $agencyId,
                    'code' => SubscriptionPack::generateCode(),
                ]);

                $this->syncChildren($package, $scoped);

                $created[] = $package;
            }

            return $created;
        });

        foreach ($packages as $package) {
            $this->logger->log(
                action: 'created',
                entityType: 'subscription-pack',
                entityId: $package->id,
                description: "Package {$package->name} créé",
                newValues: ['price' => (float) $package->price_per_month],
                request: $request,
                agencyId: $package->agency_id,
            );
        }

        return response()->json($packages[0]->fresh()->load(self::RELATIONS), 201);
    }

    public function update(Request $request, SubscriptionPack $package): JsonResponse
    {
        $data = $this->validated($request, update: true);
        unset($data['target_country_ids']);

        DB::transaction(function () use ($package, $data, $request) {
            $old = $package->only(['name', 'price_per_month', 'original_price', 'is_active']);
            $package->update(collect($data)->except(['items', 'recommendations'])->all());
            $this->syncChildren($package, $data);

            $this->logger->log(
                action: 'updated',
                entityType: 'subscription-pack',
                entityId: $package->id,
                description: "Package {$package->name} modifié",
                oldValues: $old,
                newValues: $package->only(['name', 'price_per_month', 'original_price', 'is_active']),
                request: $request,
                agencyId: $package->agency_id,
            );
        });

        return response()->json($package->fresh()->load(self::RELATIONS));
    }

    public function destroy(Request $request, SubscriptionPack $package): JsonResponse
    {
        if ($package->contracts()->exists()) {
            // Des contrats y sont liés : on désactive au lieu de supprimer (historique).
            $package->update(['is_active' => false]);

            return response()->json(['message' => 'Package désactivé : des contrats y sont rattachés.']);
        }

        $package->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'subscription-pack',
            entityId: $package->id,
            description: "Package {$package->name} supprimé",
            request: $request,
            agencyId: $package->agency_id,
        );

        return response()->json(null, 204);
    }

    /** Promotion sur un package (prix promo ou pourcentage, sur une période). */
    public function storePromotion(Request $request, SubscriptionPack $package): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['amount', 'percent'])],
            'promo_price' => ['required_if:type,amount', 'nullable', 'numeric', 'min:0'],
            'discount_percent' => ['required_if:type,percent', 'nullable', 'numeric', 'gt:0', 'max:100'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ]);

        $promotion = Promotion::create($data + ['package_id' => $package->id]);

        $this->logger->log(
            action: 'created',
            entityType: 'promotion',
            entityId: $promotion->id,
            description: "Promotion ajoutée au package {$package->name}",
            newValues: $data,
            request: $request,
            agencyId: $package->agency_id,
        );

        return response()->json($promotion, 201);
    }

    public function destroyPromotion(Request $request, SubscriptionPack $package, Promotion $promotion): JsonResponse
    {
        abort_unless($promotion->package_id === $package->id, 404);

        $promotion->delete();

        return response()->json(null, 204);
    }

    /**
     * Souscription d'un client ⇒ 1 contrat + 1 prestation pré-remplie + 1 facture (D1, D3).
     */
    public function subscribe(Request $request, SubscriptionPack $package): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'uuid', 'exists:users,id'],
            'commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'start_date' => ['nullable', 'date'],
            'periods' => ['required', 'integer', 'min:1', 'max:60'],
            'auto_renew' => ['sometimes', 'boolean'],
            'advance' => ['nullable', 'numeric', 'min:0.01'],
            'payment_type' => ['nullable', 'in:cash,om,momo,mobile'],
            // Preuve de paiement (photo) : examinée par le caissier avant validation.
            'proof_file' => ['nullable', 'file', 'image', 'mimes:jpeg,png,gif,webp', 'max:5120'],
        ]);

        abort_unless($this->access->canAccessAgency($request->user(), $package->agency_id), 403, 'Agence hors de votre périmètre.');

        // Un commercial vend en son nom propre.
        $isCommercial = $request->user()->role?->name === 'commercial';
        $commercialId = $data['commercial_id'] ?? null;
        if ($isCommercial) {
            $own = $this->access->commercialIds($request->user());
            $commercialId = $commercialId && in_array($commercialId, $own, true) ? $commercialId : ($own[0] ?? null);
        }

        // La facture d'un commercial naît « pending » : encaissement différé jusqu'à
        // l'acceptation de la preuve par le caissier (identique aux ventes, §P1-P5).
        $proofPath = null;
        if ($request->hasFile('proof_file')) {
            $proofPath = $request->file('proof_file')->store('payment-proofs', 'public');
        } elseif ($isCommercial) {
            throw ValidationException::withMessages([
                'proof_file' => 'Une preuve de paiement est obligatoire pour une souscription effectuée par un commercial.',
            ]);
        }

        $result = $this->packages->subscribe(
            package: $package,
            client: User::findOrFail($data['client_id']),
            start: Carbon::parse($data['start_date'] ?? today()->toDateString()),
            periods: (int) $data['periods'],
            commercialId: $commercialId,
            actorUserId: $request->user()->id,
            departmentId: $data['department_id'] ?? null,
            autoRenew: (bool) ($data['auto_renew'] ?? false),
            advance: isset($data['advance']) ? (float) $data['advance'] : null,
            paymentType: $data['payment_type'] ?? null,
            needsValidation: $isCommercial,
            paymentProof: $proofPath !== null ? [
                'file_path' => $proofPath,
                'payment_method' => $data['payment_type'] ?? 'cash',
                'phone_number_used' => null,
                'reference' => null,
            ] : null,
        );

        return response()->json([
            'contract' => $result['contract']->load('client:id,first_name,last_name,email', 'pack:id,name'),
            'prestation' => $result['prestation']->load('actions'),
            'invoice' => $result['invoice']->load('items'),
        ], 201);
    }

    private function validated(Request $request, bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return $request->validate([
            // L'agence n'est pas obligatoire si des pays cibles sont cochés
            // (le package est alors créé dans toutes les agences de ces pays).
            'agency_id' => $update
                ? ['sometimes', 'nullable', 'uuid', 'exists:agencies,id']
                : ['nullable', 'uuid', 'exists:agencies,id', 'required_without:target_country_ids'],
            'target_country_ids' => $update ? ['sometimes', 'nullable', 'array'] : ['nullable', 'array', 'required_without:agency_id'],
            'target_country_ids.*' => ['uuid', 'exists:countries,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['nullable', 'uuid', 'exists:agency_categories,id'],
            'name' => [$required, 'string', 'max:255'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'prerequisites' => ['nullable', 'string', 'max:5000'],
            'price_per_month' => [$required, 'numeric', 'min:0'],
            'original_price' => ['nullable', 'numeric', 'min:0'],
            'price_is_starting_from' => ['sometimes', 'boolean'],
            'billing_period' => ['sometimes', Rule::in(SubscriptionPack::BILLING_PERIODS)],
            'min_duration_months' => ['nullable', 'integer', 'min:1', 'max:120'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'is_public' => ['sometimes', 'boolean'],
            'cover_image' => ['nullable', 'string', 'max:2048'],
            'items' => ['sometimes', 'array'],
            'items.*.label' => ['required', 'string', 'max:255'],
            'items.*.service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.frequency' => ['nullable', Rule::in(['per_day', 'per_week', 'per_month', 'once'])],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.action_type' => ['nullable', Rule::in(['community_management', 'advertising', 'content_production', 'coaching', 'strategy', 'other'])],
            'recommendations' => ['sometimes', 'array'],
            'recommendations.*.label' => ['required', 'string', 'max:255'],
            'recommendations.*.quantity' => ['nullable', 'integer', 'min:1'],
            'recommendations.*.client_team_role_id' => ['nullable', 'uuid', 'exists:client_team_roles,id'],
        ], [
            'agency_id.required_without' => 'Cochez au moins un pays où créer le package.',
            'target_country_ids.required_without' => 'Cochez au moins un pays où créer le package.',
        ]);
    }

    /**
     * Réadapte un package à l'agence cible : département de l'agence, catégorie
     * (recréée dans ce département si besoin), services et rôles d'équipe liés
     * uniquement s'ils appartiennent bien à cette agence.
     */
    private function scopeToAgency(array $data, string $agencyId): array
    {
        $data['department_id'] = $this->resolveDepartment($data['department_id'] ?? null, $agencyId);
        $data['category_id'] = $this->resolveCategory($data['category_id'] ?? null, $data['department_id']);

        if (array_key_exists('items', $data)) {
            foreach ($data['items'] as $i => $item) {
                if (!empty($item['service_id']) && !Service::query()->whereKey($item['service_id'])->where('agency_id', $agencyId)->exists()) {
                    $data['items'][$i]['service_id'] = null;
                }
            }
        }

        if (array_key_exists('recommendations', $data)) {
            foreach ($data['recommendations'] as $i => $reco) {
                $data['recommendations'][$i]['client_team_role_id'] = $this->resolveRole(
                    $reco['client_team_role_id'] ?? null,
                    $data['department_id'],
                );
            }
        }

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

        // Catégorie globale (sans département) : valable partout.
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

    /** Rôle d'équipe client : réutilisé s'il appartient au département cible, sinon trouvé/créé par nom. */
    private function resolveRole(?string $roleId, ?string $departmentId): ?string
    {
        if ($roleId === null) {
            return null;
        }

        $role = ClientTeamRole::query()->find($roleId);

        if ($role === null) {
            return null;
        }

        if ($role->department_id === null || $role->department_id === $departmentId) {
            return $role->id;
        }

        if ($departmentId === null) {
            return null;
        }

        $existing = ClientTeamRole::query()
            ->where('department_id', $departmentId)
            ->where('name', $role->name)
            ->first();

        if ($existing !== null) {
            return $existing->id;
        }

        return ClientTeamRole::create([
            'department_id' => $departmentId,
            'name' => $role->name,
            'description' => $role->description,
            'color' => $role->color,
            'is_active' => $role->is_active,
        ])->id;
    }

    private function syncChildren(SubscriptionPack $package, array $data): void
    {
        if (array_key_exists('items', $data)) {
            $package->items()->delete();
            foreach (array_values($data['items']) as $i => $item) {
                $package->items()->create($item + ['sort_order' => $i]);
            }
        }

        if (array_key_exists('recommendations', $data)) {
            $package->recommendations()->delete();
            foreach (array_values($data['recommendations']) as $i => $reco) {
                $package->recommendations()->create($reco + ['sort_order' => $i, 'quantity' => $reco['quantity'] ?? 1]);
            }
        }
    }
}
