<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\ExpenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ExpenseController extends Controller
{
    public function __construct(private readonly ExpenseService $expenseService) {}

    #[OA\Get(
        path: '/api/expenses',
        summary: 'Lister les dépenses (filtres + pagination)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected', 'paid', 'closed'])),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Expense::query()->with(['agency', 'category', 'requestor']);

        if ($request->filled('status')) {
            $query->ofStatus($request->input('status'));
        }

        if ($request->filled('agency_id')) {
            $query->ofAgency($request->input('agency_id'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->betweenDates($request->input('from'), $request->input('to'));
        } elseif ($request->filled('from')) {
            $query->where('expense_date', '>=', $request->input('from'));
        } elseif ($request->filled('to')) {
            $query->where('expense_date', '<=', $request->input('to'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(fn ($q) => $q->where('number', 'like', "%{$s}%")->orWhere('note', 'like', "%{$s}%"));
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $expenses = $query->orderByDesc('expense_date')->paginate($perPage);

        return response()->json($expenses);
    }

    #[OA\Post(
        path: '/api/expenses',
        summary: 'Créer une dépense (draft)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Dépense créée'),
            new OA\Response(response: 422, description: 'Validation échouée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'agency_id' => ['required', 'uuid', 'exists:agencies,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['required', 'uuid', 'exists:accounting_categories,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'justification_path' => ['nullable', 'string', 'max:255'],
        ]);

        $expense = Expense::create($data + [
            'number' => Expense::generateNextNumber(),
            'status' => Expense::STATUS_DRAFT,
            'requested_by' => $request->user()->id,
        ]);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'department']), 201);
    }

    #[OA\Get(
        path: '/api/expenses/{expense}',
        summary: 'Détail d\'une dépense avec historique',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Détail'),
        ]
    )]
    public function show(Expense $expense): JsonResponse
    {
        return response()->json($expense->load([
            'agency', 'category', 'requestor', 'approver', 'rejector', 'payer', 'treasuryAccount', 'department',
        ]));
    }

    #[OA\Put(
        path: '/api/expenses/{expense}',
        summary: 'Modifier une dépense (draft seulement)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Dépense modifiée'),
            new OA\Response(response: 422, description: 'Modification interdite hors draft'),
        ]
    )]
    public function update(Request $request, Expense $expense): JsonResponse
    {
        abort_if($expense->status !== Expense::STATUS_DRAFT, 422, 'Seule une dépense en brouillon peut être modifiée.');

        $data = $request->validate([
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'category_id' => ['required', 'uuid', 'exists:accounting_categories,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'justification_path' => ['nullable', 'string', 'max:255'],
        ]);

        $expense->update($data);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor']));
    }
#[OA\Post(
        path: '/api/expenses/{expense}/submit',
        summary: 'Soumettre une dépense (draft → submitted)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Soumise'),
            new OA\Response(response: 422, description: 'Transition interdite'),
        ]
    )]
    public function submit(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->submit($expense, $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/approve',
        summary: 'Approuver une dépense (submitted → approved)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Approuvée'),
            new OA\Response(response: 422, description: 'Transition interdite'),
        ]
    )]
    public function approve(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->approve($expense, $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'approver']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/reject',
        summary: 'Rejeter une dépense (submitted → rejected, raison requise)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Rejetée'),
            new OA\Response(response: 422, description: 'Raison manquante ou transition interdite'),
        ]
    )]
    public function reject(Request $request, Expense $expense): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $expense = $this->expenseService->reject($expense, $data['reason'], $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'rejector']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/pay',
        summary: 'Payer une dépense (approved → paid, sortie trésorerie + écriture comptable)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Payée'),
            new OA\Response(response: 422, description: 'Compte invalide ou transition interdite'),
        ]
    )]
    public function pay(Request $request, Expense $expense): JsonResponse
    {
        $data = $request->validate([
            'treasury_account_id' => ['required', 'uuid', 'exists:treasury_accounts,id'],
        ]);

        $expense = $this->expenseService->pay($expense, $data['treasury_account_id'], $request->user()->id);

        return response()->json($expense->fresh()->load(['agency', 'category', 'requestor', 'approver', 'payer', 'treasuryAccount']));
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/close',
        summary: 'Clôturer une dépense (paid → closed)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Clôturée'),
            new OA\Response(response: 422, description: 'Transition interdite'),
        ]
    )]
    public function close(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->close($expense, $request->user()->id);

        return response()->json($expense->fresh());
    }

    #[OA\Post(
        path: '/api/expenses/{expense}/reopen',
        summary: 'Rouvrir une dépense rejetée (rejected → draft)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Rouverte'),
            new OA\Response(response: 422, description: 'Dépense non rejetée'),
        ]
    )]
    public function reopen(Expense $expense, Request $request): JsonResponse
    {
        $expense = $this->expenseService->reopen($expense, $request->user()->id);

        return response()->json($expense->fresh());
    }

    #[OA\Delete(
        path: '/api/expenses/{expense}',
        summary: 'Supprimer une dépense (draft ou rejetée seulement)',
        tags: ['Dépenses'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 204, description: 'Supprimée'),
            new OA\Response(response: 422, description: 'Suppression interdite dans cet état'),
        ]
    )]
    public function destroy(Expense $expense): JsonResponse
    {
        abort_if(! in_array($expense->status, [Expense::STATUS_DRAFT, Expense::STATUS_REJECTED], true), 422, 'Seule une dépense en brouillon ou rejetée peut être supprimée.');

        $expense->delete();

        return response()->json(null, 204);
    }
}