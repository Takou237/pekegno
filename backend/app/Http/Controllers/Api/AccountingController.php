<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Services\AccountingService;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class AccountingController extends Controller
{
    public function __construct(
        private readonly AccountingService $accountingService,
        private readonly ActivityLogger $logger,
    ) {}

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
            ->with(['agency:id,name,code', 'category:id,name,type', 'client:id,first_name,last_name', 'operator:id,first_name,last_name'])
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
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
                ."coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as expense"
            )
            ->first();

        $transactions = $base
            ->orderByDesc('transacted_at')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json([
            'transactions' => $transactions,
            'totals' => [
                'income' => (float) $totals->income,
                'expense' => (float) $totals->expense,
                'balance' => round((float) $totals->income - (float) $totals->expense, 2),
            ],
        ]);
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
            'client_id' => ['nullable', 'exists:users,id'],
            'transacted_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:255'],
            'beneficiary' => ['nullable', 'string', 'max:255'],
            'justification' => ['nullable', 'string', 'max:1000'],
        ]);

        $transaction = AccountingTransaction::create(array_merge($data, [
            'number' => $this->accountingService->nextNumber(),
            'operator_id' => $request->user()->id,
            'transacted_at' => $data['transacted_at'] ?? now(),
        ]));

        $this->logger->log(
            action: 'created',
            entityType: 'accounting',
            entityId: $transaction->id,
            description: "Transaction comptable #{$transaction->number} créée ({$transaction->label}, {$transaction->amount} FCFA)",
            newValues: $transaction->only(['number', 'type', 'label', 'amount', 'transacted_at']),
            request: $request,
        );

        return response()->json($transaction->fresh()->load(['agency', 'category', 'client', 'operator']), 201);
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

        $data = $request->validate([
            'type' => ['sometimes', Rule::in(['income', 'expense'])],
            'label' => ['sometimes', 'string', 'max:255'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'category_id' => ['nullable', 'exists:accounting_categories,id'],
            'agency_id' => ['nullable', 'exists:agencies,id'],
            'client_id' => ['nullable', 'exists:users,id'],
            'transacted_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
            'reference' => ['nullable', 'string', 'max:255'],
            'beneficiary' => ['nullable', 'string', 'max:255'],
            'justification' => ['nullable', 'string', 'max:1000'],
        ]);

        $transaction->update($data);

        $this->logger->log(
            action: 'updated',
            entityType: 'accounting',
            entityId: $transaction->id,
            description: "Transaction comptable #{$transaction->number} modifiée",
            request: $request,
        );

        return response()->json($transaction->fresh()->load(['agency', 'category', 'client', 'operator']));
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

        $number = $transaction->number;
        $transaction->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'accounting',
            entityId: $number,
            description: "Transaction comptable #{$number} supprimée",
            request: $request,
        );

        return response()->json(null, 204);
    }
}
