<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingCategory;
use App\Models\AdCampaign;
use App\Models\Agency;
use App\Models\Department;
use App\Models\Expense;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * T3.8 — Publicité Pekegno : campagnes locales (une agence) et nationales
 * (réparties au prorata du CA de la branche).
 */
class AdCampaignController extends Controller
{
    public function __construct(
        private readonly ScopeService $scope,
        private readonly ActivityLogger $logger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = AdCampaign::query()->with([
            'country:id,name,currency_code',
            'agency:id,name,code,country_id',
        ]);

        $countryIds = $this->scope->countryIds($user);
        if ($countryIds !== null) {
            $query->whereIn('country_id', $countryIds);
        }

        // Un encadrant voit les campagnes locales de son périmètre et les
        // campagnes nationales de son pays (en lecture).
        if ($this->scope->isAgencyScoped($user)) {
            $agencyIds = $this->scope->agencyIds($user) ?? [];
            $managerCountryIds = Agency::whereIn('id', $agencyIds)
                ->whereNotNull('country_id')
                ->pluck('country_id')
                ->unique()
                ->values()
                ->all();

            $query->where(function ($q) use ($agencyIds, $managerCountryIds) {
                $q->whereIn('agency_id', $agencyIds)
                    ->orWhere(fn ($sub) => $sub
                        ->where('is_national', true)
                        ->whereIn('country_id', $managerCountryIds));
            });
        }

        if ($request->filled('country_id')) {
            $query->where('country_id', $request->input('country_id'));
        }
        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->input('agency_id'));
        }
        if ($request->filled('branch')) {
            $query->where('branch', $request->input('branch'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->has('is_national')) {
            $query->where('is_national', $request->boolean('is_national'));
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%"));
        }

        $perPage = min((int) $request->input('per_page', 15), 100);

        return response()->json($query->orderByDesc('start_date')->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $data = $this->normalize($request->user(), $data);

        $campaign = AdCampaign::create($data);

        $this->createExpense($campaign, $request->user());

        $this->logger->log(
            'created',
            'ad_campaign',
            $campaign->id,
            "Campagne publicitaire créée : {$campaign->name}",
            newValues: $campaign->only(['name', 'branch', 'is_national', 'budget', 'start_date', 'end_date', 'status']),
            countryId: $campaign->country_id,
            agencyId: $campaign->agency_id,
        );

        return response()->json($campaign->load('country:id,name,currency_code', 'agency:id,name,code,country_id'), 201);
    }

    public function update(Request $request, AdCampaign $adCampaign): JsonResponse
    {
        $this->authorizeCampaign($request->user(), $adCampaign);

        $data = $this->validated($request);
        $data = $this->normalize($request->user(), $data);

        $old = $adCampaign->only(['name', 'branch', 'is_national', 'budget', 'start_date', 'end_date', 'status']);

        $adCampaign->update($data);

        $this->syncExpense($adCampaign, $request->user());

        $this->logger->log(
            'updated',
            'ad_campaign',
            $adCampaign->id,
            "Campagne publicitaire modifiée : {$adCampaign->name}",
            oldValues: $old,
            newValues: $adCampaign->only(['name', 'branch', 'is_national', 'budget', 'start_date', 'end_date', 'status']),
            countryId: $adCampaign->country_id,
            agencyId: $adCampaign->agency_id,
        );

        return response()->json($adCampaign->load('country:id,name,currency_code', 'agency:id,name,code,country_id'));
    }

    public function destroy(Request $request, AdCampaign $adCampaign): JsonResponse
    {
        $this->authorizeCampaign($request->user(), $adCampaign);

        $this->releaseExpense($adCampaign);

        $this->logger->log(
            'deleted',
            'ad_campaign',
            $adCampaign->id,
            "Campagne publicitaire supprimée : {$adCampaign->name}",
            oldValues: $adCampaign->only(['name', 'branch', 'is_national', 'budget', 'start_date', 'end_date', 'status']),
            countryId: $adCampaign->country_id,
            agencyId: $adCampaign->agency_id,
        );

        $adCampaign->delete();

        return response()->json(null, 204);
    }

    /**
     * T3.8 — la campagne engage son budget : la dépense est créée en brouillon,
     * rattachée des deux côtés (campagne.expense_id, dépense.ad_campaign_id),
     * puis suit le circuit normal (soumission, validation, paiement). Une
     * campagne locale pèse sur son agence, une campagne nationale sur
     * l'Administration de son pays (locale comme nationale).
     */
    private function createExpense(AdCampaign $campaign, User $user): void
    {
        $budget = (float) $campaign->budget;
        if ($budget <= 0) {
            return;
        }

        $categoryId = $this->expenseCategoryId();
        if ($categoryId === null) {
            return;
        }

        $expense = Expense::create([
            'number' => Expense::generateNextNumber(),
            ...$this->expenseTargets($campaign),
            'category_id' => $categoryId,
            'amount' => $budget,
            'expense_date' => $campaign->start_date->toDateString(),
            'status' => Expense::STATUS_DRAFT,
            'requested_by' => $user->id,
            'ad_campaign_id' => $campaign->id,
            'note' => "Campagne publicitaire « {$campaign->name} »",
        ]);

        $campaign->update(['expense_id' => $expense->id]);
    }

    /**
     * La campagne modifiée met à jour sa dépense tant que celle-ci n'est pas
     * engagée (brouillon ou rejetée). Passé la soumission, le montant, la date
     * et la cible ne sont plus réécrits : la dépense est dans le circuit.
     * Un budget ramené à zéro supprime la dépense non encore engagée.
     */
    private function syncExpense(AdCampaign $campaign, User $user): void
    {
        $expense = $campaign->expense;
        $budget = (float) $campaign->budget;

        if ($expense === null) {
            if ($budget > 0) {
                $this->createExpense($campaign, $user);
            }

            return;
        }

        if (! $this->isExpenseEditable($expense)) {
            return;
        }

        if ($budget <= 0) {
            $expense->delete();
            $campaign->update(['expense_id' => null]);

            return;
        }

        $expense->update([
            ...$this->expenseTargets($campaign),
            'amount' => $budget,
            'expense_date' => $campaign->start_date->toDateString(),
            'note' => "Campagne publicitaire « {$campaign->name} »",
        ]);
    }

    /**
     * Suppression de la campagne : une dépense encore modifiable disparaît avec
     * elle. Une dépense déjà engagée est conservée et détachée de la campagne,
     * pour rester traitée normalement dans le circuit des dépenses.
     */
    private function releaseExpense(AdCampaign $campaign): void
    {
        $expense = $campaign->expense;
        if ($expense === null) {
            return;
        }

        if ($this->isExpenseEditable($expense)) {
            $expense->delete();
        } else {
            $expense->update(['ad_campaign_id' => null]);
        }

        $campaign->update(['expense_id' => null]);
    }

    /** Une dépense non soumise peut encore suivre la campagne. */
    private function isExpenseEditable(Expense $expense): bool
    {
        return in_array($expense->status, [Expense::STATUS_DRAFT, Expense::STATUS_REJECTED], true);
    }

    /** @return array{agency_id: string|null, country_id: string|null} */
    private function expenseTargets(AdCampaign $campaign): array
    {
        // Cahier §2 : toute campagne est saisie une seule fois comme dépense de
        // l'Administration du pays. L'agence de la ville visée (campagne locale)
        // ou les agences au prorata du CA (nationale) la portent dans leur
        // résultat « après pub » — jamais une seconde fois dans leurs dépenses.
        return ['agency_id' => null, 'country_id' => $campaign->country_id];
    }

    /** Catégorie « Publicité Pekegno » (migration 2026_11_13_000008). */
    private function expenseCategoryId(): ?string
    {
        return AccountingCategory::query()
            ->where('type', 'expense')
            ->whereNull('agency_id')
            ->where('name', 'Publicité Pekegno')
            ->value('id')
            ?? AccountingCategory::query()
                ->where('type', 'expense')
                ->whereNull('agency_id')
                ->where('name', 'like', 'Publicité%')
                ->orderBy('name')
                ->value('id');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'branch' => ['required', Rule::in(Department::TYPES)],
            'is_national' => ['required', 'boolean'],
            'country_id' => ['nullable', 'uuid', 'exists:countries,id'],
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'budget' => ['required', 'numeric', 'min:0'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'status' => ['required', Rule::in(AdCampaign::STATUSES)],
            'description' => ['nullable', 'string', 'max:2000'],
            'expense_id' => ['nullable', 'uuid', 'exists:expenses,id'],
        ]);
    }

    /**
     * Déduit le pays de l'agence pour une campagne locale et applique le
     * périmètre de l'utilisateur (une campagne nationale reste réservée à
     * l'administration et à la direction pays).
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(?User $user, array $data): array
    {
        $national = (bool) $data['is_national'];

        if ($national) {
            if ($this->scope->isAgencyScoped($user) && $this->scope->directorCountryId($user) === null) {
                throw ValidationException::withMessages([
                    'is_national' => 'Seule l’administration peut créer une campagne nationale.',
                ]);
            }

            if (empty($data['country_id'])) {
                throw ValidationException::withMessages([
                    'country_id' => 'Le pays est obligatoire pour une campagne nationale.',
                ]);
            }

            $data['agency_id'] = null;
        } else {
            if (empty($data['agency_id'])) {
                throw ValidationException::withMessages([
                    'agency_id' => 'L’agence est obligatoire pour une campagne locale.',
                ]);
            }

            $agency = Agency::query()->findOrFail($data['agency_id']);
            $data['country_id'] = $agency->country_id;
        }

        $countryIds = $this->scope->countryIds($user);
        if ($countryIds !== null && ! in_array($data['country_id'], $countryIds, true)) {
            abort(403, 'Pays hors de votre périmètre.');
        }

        if (! $national && $this->scope->isAgencyScoped($user)) {
            $agencyIds = $this->scope->agencyIds($user) ?? [];
            if (! in_array($data['agency_id'], $agencyIds, true)) {
                abort(403, 'Agence hors de votre périmètre.');
            }
        }

        return $data;
    }

    private function authorizeCampaign(?User $user, AdCampaign $campaign): void
    {
        $countryIds = $this->scope->countryIds($user);
        if ($countryIds !== null && ! in_array($campaign->country_id, $countryIds, true)) {
            abort(403, 'Campagne hors de votre périmètre.');
        }

        if (! $this->scope->isAgencyScoped($user)) {
            return;
        }

        if ($campaign->is_national) {
            if ($this->scope->directorCountryId($user) === null) {
                abort(403, 'Campagne nationale gérée par l’administration.');
            }

            return;
        }

        $agencyIds = $this->scope->agencyIds($user) ?? [];
        if (! in_array($campaign->agency_id, $agencyIds, true)) {
            abort(403, 'Campagne hors de votre périmètre.');
        }
    }
}
