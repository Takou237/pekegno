<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class TreasuryController extends Controller
{
    public function __construct(
        private readonly TreasuryService $treasuryService,
    ) {}

    #[OA\Get(
        path: '/api/treasury/accounts',
        summary: 'Lister les comptes de trésorerie avec soldes',
        tags: ['Trésorerie'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'type', in: 'query', schema: new OA\Schema(type: 'string', enum: ['cash', 'mobile_money', 'bank'])),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste des comptes'),
        ]
    )]
    public function indexAccounts(Request $request): JsonResponse
    {
        $query = TreasuryAccount::active()->with('agency');

        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->input('agency_id'));
        }

        if ($request->filled('type')) {
            $query->ofType($request->input('type'));
        }

        $accounts = $query->get()->map(fn (TreasuryAccount $account) => array_merge(
            $account->toArray(),
            ['balance' => $this->treasuryService->balanceFor($account)],
        ));

        return response()->json($accounts);
    }

    #[OA\Get(
        path: '/api/treasury/transactions',
        summary: 'Historique des mouvements de trésorerie',
        tags: ['Trésorerie'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'treasury_account_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'direction', in: 'query', schema: new OA\Schema(type: 'string', enum: ['in', 'out'])),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Transactions paginées'),
        ]
    )]
    public function indexTransactions(Request $request): JsonResponse
    {
        $query = TreasuryTransaction::with(['account', 'creator']);

        if ($request->filled('treasury_account_id')) {
            $query->ofAccount($request->input('treasury_account_id'));
        }

        if ($request->filled('direction')) {
            $query->direction($request->input('direction'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->betweenDates($request->input('from'), $request->input('to'));
        } elseif ($request->filled('from')) {
            $query->where('transacted_at', '>=', $request->input('from'));
        } elseif ($request->filled('to')) {
            $query->where('transacted_at', '<=', $request->input('to'));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $transactions = $query->orderByDesc('transacted_at')->paginate($perPage);

        return response()->json($transactions);
    }

    #[OA\Post(
        path: '/api/treasury/transfer',
        summary: 'Transférer des fonds entre deux comptes',
        tags: ['Trésorerie'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['from_account_id', 'to_account_id', 'amount'],
                properties: [
                    new OA\Property(property: 'from_account_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'to_account_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'amount', type: 'number'),
                    new OA\Property(property: 'label', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Transfert effectué'),
            new OA\Response(response: 422, description: 'Montant invalide ou comptes identiques'),
        ]
    )]
    public function transfer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from_account_id' => ['required', 'uuid', 'exists:treasury_accounts,id'],
            'to_account_id' => ['required', 'uuid', 'exists:treasury_accounts,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'label' => ['nullable', 'string', 'max:200'],
        ]);

        $from = TreasuryAccount::findOrFail($data['from_account_id']);
        $to = TreasuryAccount::findOrFail($data['to_account_id']);

        $result = $this->treasuryService->transfer(
            from: $from,
            to: $to,
            amount: (float) $data['amount'],
            label: $data['label'] ?? null,
            createdBy: $request->user()->id,
        );

        return response()->json([
            'message' => 'Transfert effectué avec succès.',
            'reference' => $result['reference'],
            'out' => $result['out']->load('account'),
            'in' => $result['in']->load('account'),
        ]);
    }

    #[OA\Get(
        path: '/api/treasury/accounts/{account}',
        summary: 'Détail d\'un compte avec solde',
        tags: ['Trésorerie'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'account', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du compte'),
        ]
    )]
    public function showAccount(string $id): JsonResponse
    {
        $account = TreasuryAccount::with('agency')->findOrFail($id);

        return response()->json(array_merge(
            $account->toArray(),
            ['balance' => $this->treasuryService->balanceFor($account)],
        ));
    }
}
