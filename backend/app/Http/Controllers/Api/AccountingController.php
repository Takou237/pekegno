<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\Category;
use App\Models\TreasuryAccount;
use App\Services\AccountingService;
use App\Services\ActivityLogger;
use App\Services\ScopeService;
use App\Services\CatalogRevenueService;
use App\Support\SaleBranch;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class AccountingController extends Controller
{
    public function __construct(
        private readonly AccountingService $accountingService,
        private readonly ActivityLogger $logger,
        private readonly ScopeService $scope,
    ) {}

    /**
     * Périmètre caissier : uniquement son agence (user_assignments).
     * Les autres rôles non-globaux restent filtrés par les paramètres explicites.
     */
    private function applyCashierScope($query, $user, string $column = 'agency_id')
    {
        if (($user->role?->name ?? '') !== 'caissier') {
            // Chefs et directeur général : écritures de leur espace uniquement.
            return app(\App\Services\ScopeService::class)->scopeManagerQuery($query, $user, $column);
        }
        $agencyIds = DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->whereNotNull('agency_id')
            ->pluck('agency_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
        if (empty($agencyIds)) {
            return $query->whereRaw('1 = 0');
        }
        // Si un agency_id explicite est demandé, il doit appartenir au caissier.
        return $query->whereIn($column, $agencyIds);
    }

    #[OA\Get(
        path: '/api/accounting/transactions',
        summary: 'Lister les transactions comptables (filtres + totaux)',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée + totaux'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $base = AccountingTransaction::query()
            ->with(['agency:id,name,code', 'category:id,name,type', 'client:id,first_name,last_name', 'operator:id,first_name,last_name', 'treasuryAccount:id,name,code']);
        // Caissier : scope forcé à ses agences, avant tout filtre explicite.
        $base = $this->applyCashierScope($base, $request->user());
        $base = $base
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            // Comptabilité d'un département : uniquement ses écritures.
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when(
                ! $request->agency_id && $request->country_id,
                fn ($q) => $q->whereHas('agency', fn ($a) => $a->where('country_id', $request->country_id))
            )
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->category_id, fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->from, fn ($q, $d) => $q->whereDate('transacted_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('transacted_at', '<=', $d))
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $q->where('label', 'like', "%{$request->search}%")
                    ->orWhere('reference', 'like', "%{$request->search}%");
            }));

        $totals = (clone $base)
            ->selectRaw(
                "coalesce(sum(case when type = 'income' then amount else 0 end), 0) as income, "
                // T3.12 : le budget pub client n'est pas une dépense d'exploitation.
                ."coalesce(sum(case when type = 'expense' and is_transfer = false and is_pass_through = false then amount else 0 end), 0) as expense"
            )
            ->first();

        // Avant la pagination : paginate() modifie la requête (limite de 15), la
        // ventilation ne voyait sinon que les écritures de la page affichée.
        $incomeByRubric = $this->incomeByRubric(clone $base, (float) $totals->income);

        $transactions = $base
            // Numéros du plus récent au plus ancien (number = séquence croissante).
            ->orderByDesc('number')
            ->orderByDesc('transacted_at')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json([
            'transactions' => $transactions,
            'totals' => [
                'income' => (float) $totals->income,
                'expense' => (float) $totals->expense,
                'balance' => round((float) $totals->income - (float) $totals->expense, 2),
            ],
            'income_by_rubric' => $incomeByRubric,
        ]);
    }

    /**
     * Recettes du filtre ventilées par rubrique, avec la même règle que le Bilan
     * et le tableau de bord (SaleBranch) : chaque versement est réparti sur les
     * lignes de sa facture (Academy, Agency, Séminaire, catégories du
     * catalogue : Livre, Canva…). Toutes les rubriques sont listées, même
     * sans recette. Une recette saisie à la main garde sa
     * catégorie comptable.
     *
     * @return array<int, array{rubric: string, branch: string, total: float}>
     */
    private function incomeByRubric($base, float $income): array
    {
        $incomeIds = (clone $base)->where('type', 'income')->select('accounting_transactions.id')->toBase();

        $lineSums = DB::table('invoice_items')
            ->groupBy('invoice_id')
            ->selectRaw('invoice_id, sum(line_total) as lines_total');

        $rubricSql = "case when invoice_items.is_pass_through then '".SaleBranch::PASS_THROUGH."' else ".SaleBranch::categorySql().' end';
        $branchSql = "case when invoice_items.is_pass_through then 'agency' else ".SaleBranch::branchSql().' end';

        $lines = DB::table('accounting_transactions')
            ->whereIn('accounting_transactions.id', $incomeIds)
            ->join('invoice_items', 'invoice_items.invoice_id', '=', 'accounting_transactions.invoice_id')
            ->joinSub($lineSums, 'line_sums', 'line_sums.invoice_id', '=', 'accounting_transactions.invoice_id')
            ->where('line_sums.lines_total', '>', 0);

        $rows = SaleBranch::joinCatalog($lines)
            ->selectRaw("{$rubricSql} as rubric, {$branchSql} as branch, sum(accounting_transactions.amount * invoice_items.line_total / line_sums.lines_total) as total")
            ->groupByRaw("{$rubricSql}, {$branchSql}")
            ->get()
            ->map(fn ($r) => ['rubric' => $r->rubric, 'branch' => $r->branch, 'total' => (float) $r->total]);

        $manual = DB::table('accounting_transactions')
            ->whereIn('accounting_transactions.id', $incomeIds)
            ->whereNull('accounting_transactions.invoice_id')
            ->leftJoin('accounting_categories', 'accounting_categories.id', '=', 'accounting_transactions.category_id')
            ->selectRaw("coalesce(accounting_categories.name, 'Autres recettes') as rubric, sum(accounting_transactions.amount) as total")
            ->groupByRaw("coalesce(accounting_categories.name, 'Autres recettes')")
            ->get()
            ->map(fn ($r) => ['rubric' => $r->rubric, 'branch' => SaleBranch::OTHER, 'total' => (float) $r->total]);

        $byRubric = [];
        foreach ($rows->concat($manual) as $row) {
            $byRubric[$row['rubric']] ??= ['rubric' => $row['rubric'], 'branch' => $row['branch'], 'total' => 0.0];
            $byRubric[$row['rubric']]['total'] += $row['total'];
        }

        // Écriture liée à une facture sans ligne : rien n'est perdu.
        $rest = $income - array_sum(array_column($byRubric, 'total'));
        if (abs($rest) >= 0.01) {
            $byRubric[SaleBranch::UNCATEGORIZED] ??= ['rubric' => SaleBranch::UNCATEGORIZED, 'branch' => SaleBranch::OTHER, 'total' => 0.0];
            $byRubric[SaleBranch::UNCATEGORIZED]['total'] += $rest;
        }

        // Rubriques présentes même sans recette : Academy, Agency, Séminaire et
        // chaque catégorie du catalogue.
        $defaults = [SaleBranch::ACADEMY => 'academy', SaleBranch::AGENCY => 'agency', SaleBranch::SEMINAR => SaleBranch::CATALOG_BRANCH];
        foreach (Category::query()->pluck('name') as $name) {
            $defaults[$name] ??= SaleBranch::CATALOG_BRANCH;
        }
        foreach ($defaults as $name => $branch) {
            $byRubric[$name] ??= ['rubric' => $name, 'branch' => $branch, 'total' => 0.0];
        }

        return collect($byRubric)
            ->map(fn (array $r) => [...$r, 'total' => round($r['total'], 2)])
            ->sortBy([['total', 'desc'], ['rubric', 'asc']])
            ->values()
            ->all();
    }

    /**
     * Comptabilité par élément du catalogue (produits, prestations, formations,
     * packages) : quantités, facturé et encaissements par moyen de paiement.
     * Construit à la volée depuis le catalogue : un élément créé apparaît
     * aussitôt, même sans vente.
     */
    public function catalogRevenue(Request $request, CatalogRevenueService $service): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
        ]);

        $user = $request->user();
        if ($user->role?->name === 'caissier') {
            $agencyIds = DB::table('user_assignments')->where('user_id', $user->id)->pluck('agency_id')->filter()->values()->all();
        } else {
            $agencyIds = app(ScopeService::class)->agencyIds($user);
        }

        if (! empty($validated['agency_id'])) {
            abort_if($agencyIds !== null && ! in_array($validated['agency_id'], $agencyIds, true), 403, 'Agence hors de votre périmètre.');
            $agencyIds = [$validated['agency_id']];
        }

        $from = Carbon::parse($validated['from'] ?? now()->startOfMonth());
        $to = Carbon::parse($validated['to'] ?? now());

        return response()->json($service->report($from, $to, $agencyIds));
    }

    #[OA\Post(
        path: '/api/accounting/transactions',
        summary: 'Créer manuellement une entrée ou une sortie',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Transaction créée'),
            new OA\Response(response: 422, description: 'Validation échouée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['income', 'expense'])],
            'label' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'category_id' => ['nullable', 'exists:accounting_categories,id'],
            'agency_id' => ['nullable', 'exists:agencies,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'client_id' => ['nullable', 'exists:users,id'],
            'transacted_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:255'],
            'beneficiary' => ['nullable', 'string', 'max:255'],
            'justification' => ['nullable', 'string', 'max:1000'],
            // T1.4 : une dépense sort toujours d'une caisse (cahier §4, CdC §12).
            'treasury_account_id' => ['nullable', 'required_if:type,expense', 'uuid', 'exists:treasury_accounts,id'],
        ], [
            'treasury_account_id.required_if' => 'Indiquez la caisse d\'où sort cette dépense.',
        ]);

        // Cahier §14 (N25) : une sortie suit le circuit des dépenses (demande,
        // validation, paiement depuis une caisse) ; elle ne se saisit jamais
        // directement en écriture, sinon l'argent sort d'une caisse sans validation.
        abort_if(
            $data['type'] === 'expense',
            422,
            'Une sortie suit le circuit des dépenses : Comptabilité → Nouvelle transaction → Sortie, puis l\'onglet « Sorties à valider ».'
        );

        // Agence déduite de la caisse si elle n'est pas précisée.
        if (empty($data['agency_id']) && ! empty($data['treasury_account_id'])) {
            $data['agency_id'] = TreasuryAccount::whereKey($data['treasury_account_id'])->value('agency_id');
        }
        $data = $this->scopeEntry($request, $data);
        $this->assertTreasuryAccount($request, $data['treasury_account_id'] ?? null, $data['agency_id'] ?? null);

        $transaction = DB::transaction(function () use ($data, $request) {
            $transaction = AccountingTransaction::create(array_merge($data, [
                'number' => $this->accountingService->nextNumber(),
                'operator_id' => $request->user()->id,
                'transacted_at' => $data['transacted_at'] ?? now(),
            ]));
            $this->accountingService->syncManualTreasuryMovement($transaction);

            return $transaction;
        });

        $this->logger->log(
            action: 'created',
            entityType: 'accounting',
            entityId: $transaction->id,
            description: "Transaction comptable #{$transaction->number} créée ({$transaction->label}, {$transaction->amount} FCFA)",
            newValues: $transaction->only(['number', 'type', 'label', 'amount', 'transacted_at']),
            request: $request,
        );

        return response()->json($transaction->fresh()->load(['agency', 'category', 'client', 'operator', 'treasuryAccount']), 201);
    }

    #[OA\Put(
        path: '/api/accounting/transactions/{transaction}',
        summary: 'Modifier une transaction manuelle (les écritures automatiques sont protégées)',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Transaction modifiée'),
            new OA\Response(response: 422, description: 'Transaction automatique ou validation échouée'),
        ]
    )]
    public function update(Request $request, AccountingTransaction $transaction): JsonResponse
    {
        abort_if($transaction->invoice_id !== null, 422, 'Une écriture générée automatiquement ne peut pas être modifiée.');
        abort_if($transaction->is_transfer, 422, 'Cette écriture a été reclassée en transfert entre caisses : elle ne se modifie plus ici.');
        abort_if(
            $transaction->reference !== null && \App\Models\Expense::where('number', $transaction->reference)->exists(),
            422,
            'Cette écriture vient du circuit des dépenses : modifiez la dépense elle-même.'
        );
        $this->assertTransactionInScope($request, $transaction);

        $data = $request->validate([
            'type' => ['sometimes', Rule::in(['income', 'expense'])],
            'label' => ['sometimes', 'string', 'max:255'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'category_id' => ['nullable', 'exists:accounting_categories,id'],
            'agency_id' => ['nullable', 'exists:agencies,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'client_id' => ['nullable', 'exists:users,id'],
            'transacted_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:255'],
            'beneficiary' => ['nullable', 'string', 'max:255'],
            'justification' => ['nullable', 'string', 'max:1000'],
            'treasury_account_id' => ['nullable', 'uuid', 'exists:treasury_accounts,id'],
        ]);

        $type = $data['type'] ?? $transaction->type;
        // Corriger une sortie existante reste possible (N25) ; transformer une
        // recette en sortie contournerait le circuit des dépenses.
        abort_if(
            $type === 'expense' && $transaction->type !== 'expense',
            422,
            'Une sortie suit le circuit des dépenses : Comptabilité → Nouvelle transaction → Sortie, puis l\'onglet « Sorties à valider ».'
        );
        $categoryId = array_key_exists('category_id', $data) ? $data['category_id'] : $transaction->category_id;
        abort_if(
            $type === 'expense' && $categoryId
                && AccountingTransaction::looksLikeTransfer(\App\Models\AccountingCategory::whereKey($categoryId)->value('name')),
            422,
            AccountingTransaction::TRANSFER_NOT_EXPENSE_MESSAGE
        );
        $accountId = array_key_exists('treasury_account_id', $data) ? $data['treasury_account_id'] : $transaction->treasury_account_id;
        abort_if($type === 'expense' && $accountId === null, 422, "Indiquez la caisse d'où sort cette dépense.");
        $scoped = $this->scopeEntry($request, [
            'agency_id' => array_key_exists('agency_id', $data) ? $data['agency_id'] : $transaction->agency_id,
            'treasury_account_id' => $accountId,
        ]);
        $data['agency_id'] = $scoped['agency_id'];
        if (array_key_exists('country_id', $scoped)) {
            $data['country_id'] = $scoped['country_id'];
        }
        $this->assertTreasuryAccount($request, $accountId, $data['agency_id']);

        DB::transaction(function () use ($transaction, $data) {
            $transaction->update($data);
            $this->accountingService->syncManualTreasuryMovement($transaction->fresh());
        });

        $this->logger->log(
            action: 'updated',
            entityType: 'accounting',
            entityId: $transaction->id,
            description: "Transaction comptable #{$transaction->number} modifiée",
            request: $request,
        );

        return response()->json($transaction->fresh()->load(['agency', 'category', 'client', 'operator', 'treasuryAccount']));
    }

    #[OA\Delete(
        path: '/api/accounting/transactions/{transaction}',
        summary: 'Supprimer une transaction manuelle (les écritures automatiques sont protégées)',
        tags: ['Comptabilité'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Transaction supprimée'),
            new OA\Response(response: 422, description: 'Transaction automatique'),
        ]
    )]
    public function destroy(Request $request, AccountingTransaction $transaction): JsonResponse
    {
        abort_if($transaction->invoice_id !== null, 422, 'Une écriture générée automatiquement ne peut pas être supprimée.');
        abort_if(
            $transaction->reference !== null && \App\Models\Expense::where('number', $transaction->reference)->exists(),
            422,
            'Cette écriture vient du circuit des dépenses : modifiez la dépense elle-même.'
        );
        $this->assertTransactionInScope($request, $transaction);

        $number = $transaction->number;
        DB::transaction(function () use ($transaction) {
            $this->accountingService->syncManualTreasuryMovement($transaction, deleted: true);
            $transaction->delete();
        });

        $this->logger->log(
            action: 'deleted',
            entityType: 'accounting',
            entityId: $number,
            description: "Transaction comptable #{$number} supprimée",
            request: $request,
        );

        return response()->json(null, 204);
    }

    /**
     * Périmètre d'une écriture manuelle (cahier §5) : agence du périmètre de
     * l'utilisateur ; sans agence, c'est une écriture de l'Administration d'un
     * pays, réservée au super-admin, à la direction et au comptable, et rangée
     * sous le pays de sa caisse (vue Pays, bloc Administration).
     */
    private function scopeEntry(Request $request, array $data): array
    {
        $user = $request->user();
        $scope = app(ScopeService::class);
        $agencyIds = $scope->isGlobal($user) ? null : $scope->agencyIds($user);
        if ($agencyIds === null && $user?->role?->name === 'caissier') {
            abort(403, 'Aucune agence affectée.');
        }

        // Une seule agence dans le périmètre : elle est l'agence par défaut
        // (sauf si une caisse est choisie : l'agence est alors celle de la caisse).
        if (empty($data['agency_id']) && empty($data['treasury_account_id']) && $agencyIds !== null && count($agencyIds) === 1
            && ! in_array($user?->role?->name, \App\Http\Controllers\Api\ExpenseController::ADMINISTRATION_ROLES, true)) {
            $data['agency_id'] = $agencyIds[0];
        }

        if (! empty($data['agency_id'])) {
            abort_unless($agencyIds === null || in_array($data['agency_id'], $agencyIds, true), 403, 'Hors périmètre agence.');

            return $data;
        }

        abort_unless(
            in_array($user?->role?->name, \App\Http\Controllers\Api\ExpenseController::ADMINISTRATION_ROLES, true),
            403,
            "Seuls l'administrateur, la direction générale et le comptable saisissent les écritures de l'Administration."
        );

        $data['agency_id'] = null;
        $countryId = ! empty($data['treasury_account_id'])
            ? TreasuryAccount::whereKey($data['treasury_account_id'])->value('country_id')
            : null;
        if ($countryId !== null) {
            $countries = $scope->countryIds($user);
            abort_unless($countries === null || in_array($countryId, $countries, true), 403, 'Pays hors de votre périmètre.');
            $data['country_id'] = $countryId;
        }

        return $data;
    }

    /** Une écriture hors du périmètre de l'utilisateur ne se modifie ni ne se supprime. */
    private function assertTransactionInScope(Request $request, AccountingTransaction $transaction): void
    {
        $user = $request->user();
        $scope = app(ScopeService::class);
        if ($scope->isGlobal($user)) {
            return;
        }
        $agencyIds = $scope->agencyIds($user);
        if ($agencyIds === null && $user?->role?->name === 'caissier') {
            $agencyIds = [];
        }

        $inScope = $transaction->agency_id !== null
            ? ($agencyIds === null || in_array($transaction->agency_id, $agencyIds, true))
            : (in_array($user?->role?->name, \App\Http\Controllers\Api\ExpenseController::ADMINISTRATION_ROLES, true)
                && (($countries = $scope->countryIds($user)) === null || $transaction->country_id === null || in_array($transaction->country_id, $countries, true)));

        abort_unless($inScope, 403, 'Hors périmètre agence.');
    }

    /**
     * La caisse d'une écriture manuelle doit être active, de la même agence que
     * l'écriture et visible de l'utilisateur (une caissière ne débite pas O/M/B).
     */
    private function assertTreasuryAccount(Request $request, ?string $accountId, ?string $agencyId): void
    {
        if ($accountId === null) {
            return;
        }

        $account = TreasuryAccount::where('id', $accountId)->where('is_active', true)->first();
        abort_if(! $account, 422, 'Caisse inexistante ou inactive.');
        abort_if(
            $account->agency_id !== null && $account->agency_id !== $agencyId,
            422,
            "La caisse choisie n'appartient pas à l'agence de l'écriture."
        );
        abort_if(
            $account->agency_id === null && $agencyId !== null,
            422,
            "Une caisse de l'Administration ne porte que des écritures de l'Administration."
        );
        $this->authorize('view', $account);
    }
}
