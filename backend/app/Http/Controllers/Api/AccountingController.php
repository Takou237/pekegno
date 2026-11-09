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
                ."coalesce(sum(case when type = 'expense' and is_transfer = false then amount else 0 end), 0) as expense"
            )
            ->first();

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
            'income_by_rubric' => $this->incomeByRubric($base, (float) $totals->income),
        ]);
    }

    /**
     * Recettes du filtre ventilées par rubrique, avec la même règle que le Bilan
     * et le tableau de bord (SaleBranch) : chaque versement est réparti sur les
     * lignes de sa facture (Formations, catégories Agency, catégories du
     * catalogue : Livre, Canva…). Toutes les catégories du catalogue sont
     * listées, même sans recette. Une recette saisie à la main garde sa
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

        $rubricSql = "case when invoice_items.is_pass_through then '".self::PASS_THROUGH_RUBRIC."' else ".SaleBranch::categorySql().' end';
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

        foreach (Category::query()->pluck('name') as $name) {
            $byRubric[$name] ??= ['rubric' => $name, 'branch' => SaleBranch::CATALOG_BRANCH, 'total' => 0.0];
        }

        return collect($byRubric)
            ->map(fn (array $r) => [...$r, 'total' => round($r['total'], 2)])
            ->sortBy([['total', 'desc'], ['rubric', 'asc']])
            ->values()
            ->all();
    }

    private const PASS_THROUGH_RUBRIC = 'Budget pub client';

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

        // Caissier : force l'agence à son périmètre, refuse toute autre agence.
        if (($request->user()->role?->name ?? '') === 'caissier') {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $request->user()->id)
                ->whereNotNull('agency_id')
                ->pluck('agency_id')
                ->filter()
                ->unique()
                ->values()
                ->all();
            if (empty($agencyIds)) {
                abort(403, 'Aucune agence affectée.');
            }
            if (empty($data['agency_id'])) {
                $data['agency_id'] = $agencyIds[0];
            }
            abort_unless(in_array($data['agency_id'], $agencyIds, true), 403, 'Hors périmètre agence.');
        }

        // B13 : un versement en banque / décaissement administratif n'est pas une
        // dépense mais un transfert entre caisses (Trésorerie → Transfert).
        if ($data['type'] === 'expense' && ! empty($data['category_id'])) {
            $categoryName = \App\Models\AccountingCategory::whereKey($data['category_id'])->value('name');
            abort_if(
                AccountingTransaction::looksLikeTransfer($categoryName),
                422,
                'Un versement en banque ou un décaissement vers l\'administration est un transfert entre caisses, pas une dépense : utilisez Trésorerie → Transfert.'
            );
        }

        // Agence déduite de la caisse si elle n'est pas précisée.
        if (empty($data['agency_id']) && ! empty($data['treasury_account_id'])) {
            $data['agency_id'] = TreasuryAccount::whereKey($data['treasury_account_id'])->value('agency_id');
        }
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
        if (($request->user()->role?->name ?? '') === 'caissier') {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $request->user()->id)
                ->whereNotNull('agency_id')
                ->pluck('agency_id')
                ->filter()
                ->unique()
                ->values()
                ->all();
            abort_unless($transaction->agency_id && in_array($transaction->agency_id, $agencyIds, true), 403, 'Hors périmètre agence.');
        }

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
        $accountId = array_key_exists('treasury_account_id', $data) ? $data['treasury_account_id'] : $transaction->treasury_account_id;
        abort_if($type === 'expense' && $accountId === null, 422, "Indiquez la caisse d'où sort cette dépense.");
        $this->assertTreasuryAccount($request, $accountId, array_key_exists('agency_id', $data) ? $data['agency_id'] : $transaction->agency_id);

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
        if (($request->user()->role?->name ?? '') === 'caissier') {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $request->user()->id)
                ->whereNotNull('agency_id')
                ->pluck('agency_id')
                ->filter()
                ->unique()
                ->values()
                ->all();
            abort_unless($transaction->agency_id && in_array($transaction->agency_id, $agencyIds, true), 403, 'Hors périmètre agence.');
        }

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
        $this->authorize('view', $account);
    }
}
