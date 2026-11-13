<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class TreasuryController extends Controller
{
    public function __construct(
        private readonly TreasuryService $treasuryService,
    ) {}

    /**
     * Agences du périmètre, null = tout (direction).
     *
     * @return array<int, string>|null
     */
    private function scopeAgencyIds($user): ?array
    {
        if (app(\App\Services\ScopeService::class)->isGlobal($user)) {
            return null;
        }

        return app(\App\Services\ScopeService::class)->agencyIds($user) ?? [];
    }

    /** Seul l'administrateur (super-admin) crée / modifie les caisses. */
    private const ACCOUNT_ADMIN_ROLES = ['super-admin'];

    /**
     * Moyens de paiement proposés dans les formulaires : une caisse = un moyen
     * de paiement (agence donnée, sinon tout le réseau).
     */
    public function paymentMethods(Request $request): JsonResponse
    {
        return response()->json(\App\Support\PaymentMethods::forAgency($request->query('agency_id')));
    }

    /**
     * Nouvelle caisse : crée aussi le moyen de paiement correspondant, proposé
     * ensuite dans les formulaires de vente et ventilé dans les tableaux.
     * Une caisse du même nom dans une autre agence partage le même moyen.
     */
    public function storeAccount(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()?->role?->name, self::ACCOUNT_ADMIN_ROLES, true), 403, 'Seul l\'administrateur peut créer une caisse.');

        $data = $request->validate([
            'agency_id' => ['required', 'uuid', 'exists:agencies,id'],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'in:cash,mobile_money,bank'],
            'account_number' => ['nullable', 'string', 'max:50'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'visible_to_cashier' => ['sometimes', 'boolean'],
        ]);

        $agency = \App\Models\Agency::with('geoCountry')->findOrFail($data['agency_id']);
        $scopeIds = $this->scopeAgencyIds($request->user());
        abort_if($scopeIds !== null && ! in_array($agency->id, $scopeIds, true), 403, 'Cette agence est hors de votre périmètre.');
        $key = \App\Support\PaymentMethods::keyFromName($data['name']);
        $standard = \App\Support\PaymentMethods::STANDARD[$key] ?? null;

        abort_if(
            TreasuryAccount::where('agency_id', $agency->id)->where('method_key', $key)->exists(),
            422,
            "L'agence a déjà la caisse « {$data['name']} »."
        );

        $code = $standard['code'] ?? $this->nextAccountCode($agency->id, $data['name']);
        $visibleToCashier = (bool) ($data['visible_to_cashier'] ?? $data['type'] === TreasuryAccount::TYPE_CASH);

        $account = TreasuryAccount::create([
            'agency_id' => $agency->id,
            'name' => $data['name'],
            'code' => $code,
            'method_key' => $key,
            'type' => $standard['type'] ?? $data['type'],
            'account_number' => $data['account_number'] ?? null,
            'opening_balance' => $data['opening_balance'] ?? 0,
            'currency_code' => $agency->geoCountry?->currency_code ?? 'XAF',
            'is_active' => true,
            'visible_roles' => $visibleToCashier ? null : \App\Services\TreasuryAccountProvisioner::RESTRICTED_ROLES,
        ]);
        \App\Support\PaymentMethods::flush();

        return response()->json(array_merge($account->toArray(), ['balance' => $this->treasuryService->balanceFor($account)]), 201);
    }

    /** Renommer, activer / désactiver une caisse (le moyen de paiement suit). */
    public function updateAccount(Request $request, TreasuryAccount $account): JsonResponse
    {
        abort_unless(in_array($request->user()?->role?->name, self::ACCOUNT_ADMIN_ROLES, true), 403, 'Seul l\'administrateur peut modifier une caisse.');

        $scopeIds = $this->scopeAgencyIds($request->user());
        abort_if($scopeIds !== null && ! in_array($account->agency_id, $scopeIds, true), 403, 'Cette caisse est hors de votre périmètre.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'account_number' => ['nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'visible_to_cashier' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('visible_to_cashier', $data)) {
            $data['visible_roles'] = $data['visible_to_cashier'] ? null : \App\Services\TreasuryAccountProvisioner::RESTRICTED_ROLES;
            unset($data['visible_to_cashier']);
        }

        $account->update($data);
        \App\Support\PaymentMethods::flush();

        return response()->json(array_merge($account->fresh()->toArray(), ['balance' => $this->treasuryService->balanceFor($account)]));
    }

    /** Code court unique dans l'agence (initiales du nom : « Airtel Money » → AM). */
    private function nextAccountCode(string $agencyId, string $name): string
    {
        $used = TreasuryAccount::withTrashed()->where('agency_id', $agencyId)->pluck('code')->filter()->all();
        $initials = collect(preg_split('/\s+/', \Illuminate\Support\Str::ascii($name)))
            ->map(fn ($w) => strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $w), 0, 1)))
            ->implode('');
        $base = substr($initials !== '' ? $initials : 'X', 0, 3);

        if (! in_array($base, $used, true)) {
            return $base;
        }
        for ($i = 2; $i < 100; $i++) {
            if (! in_array($base.$i, $used, true)) {
                return substr($base, 0, 3).$i;
            }
        }

        return 'X'.random_int(100, 999);
    }

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
        $query = TreasuryAccount::active()->with('agency')->visibleTo($request->user());

        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->input('agency_id'));
        }

        // Hors direction : trésorerie limitée aux agences du périmètre.
        $scopeIds = $this->scopeAgencyIds($request->user());
        if ($scopeIds !== null) {
            $query->whereIn('agency_id', $scopeIds);
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

        // Hors direction : mouvements limités aux comptes du périmètre.
        $scopeIds = $this->scopeAgencyIds($request->user());
        if ($scopeIds !== null) {
            $query->whereHas('account', fn ($q) => $q->whereIn('agency_id', $scopeIds));
        }

        // T2.3/T2.4 : une caissière ne voit pas les mouvements O/M/B.
        $query->whereHas('account', fn ($q) => $q->visibleTo($request->user()));

        if ($request->filled('treasury_account_id')) {
            $query->ofAccount($request->input('treasury_account_id'));
        }

        if ($request->filled('direction')) {
            $query->direction($request->input('direction'));
        }

        // Nature du mouvement : transferts seulement, ou tout sauf transferts.
        if ($request->input('kind') === 'transfer') {
            $query->where('source_type', 'transfer');
        } elseif ($request->input('kind') === 'movement') {
            $query->where(fn ($q) => $q->whereNull('source_type')->orWhere('source_type', '!=', 'transfer'));
        }

        $from = $request->filled('from') ? Carbon::parse($request->input('from'))->startOfDay() : null;
        $to = $request->filled('to') ? Carbon::parse($request->input('to'))->endOfDay() : null;

        if ($from && $to) {
            $query->betweenDates($from->toDateTimeString(), $to->toDateTimeString());
        } elseif ($from) {
            $query->where('transacted_at', '>=', $from);
        } elseif ($to) {
            $query->where('transacted_at', '<=', $to);
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
            'transfer_type' => ['nullable', 'string', 'in:'.implode(',', TreasuryTransaction::TRANSFER_TYPES)],
        ]);

        $from = TreasuryAccount::findOrFail($data['from_account_id']);
        $to = TreasuryAccount::findOrFail($data['to_account_id']);

        $this->authorize('transfer', $from);
        $this->authorize('transfer', $to);

        // Hors direction : transfert limité aux comptes du périmètre.
        $scopeIds = $this->scopeAgencyIds($request->user());
        if ($scopeIds !== null
            && (! in_array($from->agency_id, $scopeIds, true) || ! in_array($to->agency_id, $scopeIds, true))) {
            abort(403, 'Transfert hors de votre périmètre.');
        }

        $result = $this->treasuryService->transfer(
            from: $from,
            to: $to,
            amount: (float) $data['amount'],
            label: $data['label'] ?? null,
            createdBy: $request->user()->id,
            transferType: $data['transfer_type'] ?? 'internal',
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

        $this->authorize('view', $account);

        $scopeIds = $this->scopeAgencyIds(request()->user());
        if ($scopeIds !== null && ! in_array($account->agency_id, $scopeIds, true)) {
            abort(403, 'Compte hors de votre périmètre.');
        }

        return response()->json(array_merge(
            $account->toArray(),
            ['balance' => $this->treasuryService->balanceFor($account)],
        ));
    }
}
