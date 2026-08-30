<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commercial;
use App\Models\CommissionEntry;
use App\Models\CommissionPayment;
use App\Models\CommissionRule;
use App\Models\SellerProfile;
use App\Models\TreasuryAccount;
use App\Services\AccountingService;
use App\Services\CommissionService;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class CommissionController extends Controller
{
    public function __construct(
        private readonly TreasuryService $treasuryService,
        private readonly AccountingService $accountingService,
        private readonly CommissionService $commissionService,
    ) {}

    #[OA\Get(path: '/api/commission-rules', summary: 'Lister les règles (dernières versions)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Règles')])]
    public function indexRules(Request $request): JsonResponse
    {
        $query = CommissionRule::query()->with(['beneficiary', 'sellerProfile.user', 'course', 'service', 'scopeAgency', 'scopeCountry', 'scopeDepartment']);

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->input('course_id'));
        }

        $latestIds = CommissionRule::query()
            ->selectRaw('DISTINCT ON (rule_group_id) id')
            ->orderBy('rule_group_id')
            ->orderByDesc('version')
            ->pluck('id');

        $rules = $query->whereIn('id', $latestIds)->orderBy('name')->get();

        return response()->json($rules);
    }

    #[OA\Post(path: '/api/commission-rules', summary: 'Créer une règle (version 1)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 201, description: 'Règle créée')])]
    public function storeRule(Request $request): JsonResponse
    {
        $data = $this->validateRulePayload($request);

        $rule = CommissionRule::create($data + [
            'rule_group_id' => (string) Str::uuid(),
            'version' => 1,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($rule->fresh()->load(['beneficiary', 'sellerProfile.user', 'course', 'service', 'scopeAgency', 'scopeCountry', 'scopeDepartment']), 201);
    }

    #[OA\Put(path: '/api/commission-rules/{rule}', summary: 'Modifier → nouvelle version (ancienne désactivée)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Nouvelle version')])]
    public function updateRule(Request $request, CommissionRule $rule): JsonResponse
    {
        $data = $this->validateRulePayload($request);

        $rule->update(['is_active' => false]);

        $newVersion = CommissionRule::create($data + [
            'rule_group_id' => $rule->rule_group_id,
            'version' => $rule->version + 1,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($newVersion->fresh()->load(['beneficiary', 'sellerProfile.user', 'course', 'service', 'scopeAgency', 'scopeCountry', 'scopeDepartment']));
    }

    #[OA\Get(path: '/api/commission-rules/{rule}/versions', summary: 'Historique des versions d\'une règle', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Versions')])]
    public function ruleVersions(CommissionRule $rule): JsonResponse
    {
        return response()->json(CommissionRule::query()->where('rule_group_id', $rule->rule_group_id)->orderByDesc('version')->get());
    }

    #[OA\Delete(path: '/api/commission-rules/{rule}', summary: 'Désactiver une règle', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Règle désactivée')])]
    public function destroyRule(CommissionRule $rule): JsonResponse
    {
        $rule->update(['is_active' => false]);

        return response()->json(['message' => 'Règle désactivée.']);
    }
#[\OA\Get(path: '/api/commissions/entries', summary: 'Lister les lignes de commission', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Entrées paginées')])]
    public function indexEntries(Request $request): JsonResponse
    {
        $query = CommissionEntry::query()->with(['invoice', 'beneficiary', 'sellerProfile.user', 'rule', 'validator', 'payer']);

        if ($request->filled('status')) {
            $query->ofStatus($request->input('status'));
        }

        if ($request->filled('beneficiary_commercial_id')) {
            $query->where('beneficiary_commercial_id', $request->input('beneficiary_commercial_id'));
        }

        if ($request->filled('seller_profile_id')) {
            $query->where('seller_profile_id', $request->input('seller_profile_id'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->betweenDates($request->input('from'), $request->input('to'));
        } elseif ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from').' 00:00:00');
        } elseif ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to').' 23:59:59');
        }

        $entries = $query->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($entries);
    }

    #[OA\Post(path: '/api/commissions/entries', summary: 'Créer une entrée de commission manuelle (validée d\'emblée)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 201, description: 'Entrée créée')])]
    public function storeEntry(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seller_profile_id' => ['required', 'uuid', 'exists:seller_profiles,id'],
            'category' => ['required', 'string', 'in:training,service'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'label' => ['nullable', 'string', 'max:250'],
            'invoice_id' => ['nullable', 'uuid', 'exists:invoices,id'],
        ]);

        $entry = CommissionEntry::create([
            'seller_profile_id' => $validated['seller_profile_id'],
            'category' => $validated['category'],
            'base_amount' => $validated['amount'],
            'amount' => $validated['amount'],
            'invoice_id' => $validated['invoice_id'] ?? null,
            'status' => CommissionEntry::STATUS_VALIDATED,
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
            'rule_snapshot' => [
                'manual' => true,
                'label' => $validated['label'] ?? 'Commission manuelle',
            ],
        ]);

        return response()->json($entry->fresh()->load(['invoice', 'sellerProfile.user', 'rule']), 201);
    }

    #[OA\Put(path: '/api/commissions/entries/{entry}', summary: 'Surcharger le montant d\'une entrée (calculated/validated)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Montant mis à jour')])]
    public function updateEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! in_array($entry->status, [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED], true), 422, 'Impossible de modifier une commission payée ou annulée.');

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'label' => ['nullable', 'string', 'max:250'],
        ]);

        $entry->amount = $validated['amount'];

        if (array_key_exists('label', $validated)) {
            $snapshot = $entry->rule_snapshot ?? [];
            $snapshot['manual'] = true;
            $snapshot['label'] = $validated['label'];
            $entry->rule_snapshot = $snapshot;
        }

        $entry->save();

        return response()->json($entry->fresh()->load(['invoice', 'sellerProfile.user', 'rule']));
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/validate', summary: 'Valider (calculated → validated)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Validée')])]
    public function validateEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! $entry->transitionTo(CommissionEntry::STATUS_VALIDATED, $request->user()->id), 422, 'Impossible de valider cette commission (statut actuel : '.$entry->status.').');

        return response()->json($entry->fresh()->load(['invoice', 'beneficiary', 'sellerProfile', 'rule', 'validator']));
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/pay', summary: 'Payer (validated → paid)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Payée')])]
    public function payEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! $entry->transitionTo(CommissionEntry::STATUS_PAID, $request->user()->id), 422, 'Impossible de payer cette commission (statut actuel : '.$entry->status.').');

        return response()->json($entry->fresh()->load(['invoice', 'beneficiary', 'sellerProfile', 'rule', 'payer']));
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/cancel', summary: 'Annuler (calculated → cancelled)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Annulée')])]
    public function cancelEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if(! $entry->transitionTo(CommissionEntry::STATUS_CANCELLED, $request->user()->id), 422, 'Impossible d\'annuler cette commission (statut actuel : '.$entry->status.').');

        return response()->json($entry->fresh());
    }

    /**
     * Rejoue la génération des commissions sur chaque versement d'un profil vendeur
     * (idempotent). Utilisé depuis la fiche formateur après modification du taux ou
     * ajout d'une règle par service/formation pour prendre en compte les encaissements existants.
     */
    public function recalculateSeller(Request $request, SellerProfile $sellerProfile): JsonResponse
    {
        $result = $this->commissionService->recalculateForSellerProfile($sellerProfile, $request->user()->id);

        return response()->json(['data' => $result]);
    }

    /**
     * Liste les bénéficiaires (vendeurs + commerciaux) avec leurs soldes de commissions.
     */
    public function summary(Request $request): JsonResponse
    {
        $agencyId = $request->input('agency_id');
        $search = strtolower(trim((string) $request->input('search', '')));

        $sellers = SellerProfile::query()
            ->with('user')
            ->where('is_active', true)
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->get()
            ->map(fn (SellerProfile $p) => $this->summaryBeneficiary(
                id: $p->id,
                type: 'seller_profile',
                name: $p->full_name,
                kind: $p->kind,
                commissionType: $p->commission_type,
                commissionValue: $p->commission_value,
                search: $search,
            ))
            ->filter()
            ->values();

        $commercials = Commercial::query()
            ->with('user')
            ->where('is_active', true)
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->get()
            ->map(fn (Commercial $c) => $this->summaryBeneficiary(
                id: $c->id,
                type: 'commercial',
                name: trim("{$c->first_name} {$c->last_name}") ?: ($c->user?->name ?? $c->email ?? 'Commercial'),
                kind: $c->kind,
                commissionType: $c->commission_type,
                commissionValue: $c->commission_value,
                search: $search,
            ))
            ->filter()
            ->values();

        $all = collect()
            ->merge($sellers)
            ->merge($commercials)
            ->sortByDesc(fn ($b) => $b['balance'] ?? 0)
            ->values();

        return response()->json([
            'data' => $all,
            'totals' => [
                'total_owed' => round($all->sum(fn ($b) => $b['total_owed'] ?? 0), 2),
                'total_paid' => round($all->sum(fn ($b) => $b['total_paid'] ?? 0), 2),
            ],
        ]);
    }

    /**
     * Payer une commission (totale ou partielle) pour un vendeur ou un commercial.
     * Enregistre le paiement + sortie de trésorerie + écriture comptable, et marque
     * les entrées payées au fil de l'eau (FIFO) sans jamais dépasser le solde dû.
     */
    public function storePayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'beneficiary_type' => ['required', 'string', 'in:seller_profile,commercial'],
            'beneficiary_id' => ['required', 'uuid'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'treasury_account_id' => ['nullable', 'uuid', 'exists:treasury_accounts,id'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $amount = (float) $validated['amount'];
        $actorId = $request->user()->id;

        $sellerProfile = null;
        $commercial = null;
        $agencyId = null;
        $beneficiaryName = 'Bénéficiaire';

        if ($validated['beneficiary_type'] === 'seller_profile') {
            $sellerProfile = SellerProfile::with('user')->where('is_active', true)->findOrFail($validated['beneficiary_id']);
            $agencyId = $sellerProfile->agency_id;
            $beneficiaryName = $sellerProfile->full_name;
        } else {
            $commercial = Commercial::with('user')->where('is_active', true)->findOrFail($validated['beneficiary_id']);
            $agencyId = $commercial->agency_id;
            $beneficiaryName = trim("{$commercial->first_name} {$commercial->last_name}")
                ?: ($commercial->user?->name ?? $commercial->email ?? 'Commercial');
        }

        $balance = $this->balanceForBeneficiary($sellerProfile, $commercial);

        abort_if($amount > $balance + 0.005, 422, 'Impossible de payer : le montant excède le solde disponible ('.number_format(max($balance, 0), 2).' FCFA).');

        $account = null;

        if ($validated['treasury_account_id'] ?? null) {
            $account = TreasuryAccount::where('id', $validated['treasury_account_id'])->where('is_active', true)->first();
            abort_if(! $account, 422, 'Compte de trésorerie inexistant ou inactif.');
        } elseif ($agencyId) {
            // Aucun compte fourni : on débite la caisse par défaut de l'agence du bénéficiaire.
            $account = TreasuryAccount::query()
                ->where('agency_id', $agencyId)
                ->where('type', 'cash')
                ->where('is_active', true)
                ->orderBy('created_at')
                ->first();
        }

        $payment = DB::transaction(function () use ($sellerProfile, $commercial, $amount, $account, $validated, $actorId, $agencyId, $beneficiaryName) {
            // 1. Marquage FIFO des entrées couvertes par ce paiement (paiement partiel possible).
            $entriesQuery = CommissionEntry::query()
                ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
                ->orderBy('created_at')
                ->orderBy('id');

            if ($sellerProfile) {
                $entriesQuery->where('seller_profile_id', $sellerProfile->id);
            } else {
                $entriesQuery->where('beneficiary_commercial_id', $commercial->id);
            }

            $coveredEntry = null;
            $remaining = $amount;

            foreach ($entriesQuery->limit(500)->get() as $entry) {
                if ($remaining <= 0.005) {
                    break;
                }

                $entryAmount = (float) $entry->amount;

                if ($remaining >= $entryAmount - 0.005) {
                    if ($entry->status === CommissionEntry::STATUS_CALCULATED) {
                        $entry->transitionTo(CommissionEntry::STATUS_VALIDATED, $actorId);
                    }
                    $entry->transitionTo(CommissionEntry::STATUS_PAID, $actorId);
                    $coveredEntry ??= $entry->id;
                    $remaining = round($remaining - $entryAmount, 2);
                }
            }

            $reference = 'COMM-'.strtoupper(substr($sellerProfile?->id ?? $commercial->id, 0, 8)).'-'.now()->format('YmdHis');

            // 2. Paiement enregistré.
            $commissionPayment = CommissionPayment::create([
                'commercial_id' => $commercial?->id,
                'seller_profile_id' => $sellerProfile?->id,
                'commission_entry_id' => $coveredEntry,
                'treasury_account_id' => $account?->id,
                'amount' => $amount,
                'base_amount' => $amount,
                'rule' => 'commission_payment',
                'invoice_total' => 0,
                'created_by' => $actorId,
            ]);

            // 3. Sortie de trésorerie (si un compte a été résolu).
            if ($account) {
                $this->treasuryService->recordMovement(
                    account: $account,
                    direction: 'out',
                    amount: $amount,
                    label: "Commission — {$beneficiaryName}",
                    sourceType: 'commission_payment',
                    sourceId: $commissionPayment->id,
                    category: 'commission',
                    reference: $reference,
                    createdBy: $actorId,
                );
            }

            // 4. Écriture comptable (dépense) — catégorie dédiée « Commissions ».
            $category = $this->accountingService->commissionExpenseCategory();
            if ($category && $agencyId) {
                \App\Models\AccountingTransaction::create([
                    'number' => $this->accountingService->nextNumber(),
                    'agency_id' => $agencyId,
                    'category_id' => $category->id,
                    'type' => 'expense',
                    'label' => "Commission — {$beneficiaryName}",
                    'reference' => $reference,
                    'amount' => $amount,
                    'transacted_at' => now(),
                    'operator_id' => $actorId,
                    'note' => $validated['note'] ?? null,
                    'beneficiary' => $beneficiaryName,
                ]);
            }

            return $commissionPayment;
        });

        $payment->load(['commercial.user', 'sellerProfile.user', 'treasuryAccount', 'commissionEntry']);

        return response()->json($payment, 201);
    }

    private function balanceForBeneficiary(?SellerProfile $sellerProfile, ?Commercial $commercial): float
    {
        $query = CommissionEntry::query()
            ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED]);

        if ($sellerProfile) {
            $query->where('seller_profile_id', $sellerProfile->id);
        } elseif ($commercial) {
            $query->where('beneficiary_commercial_id', $commercial->id);
        } else {
            return 0.0;
        }

        // Solde disponible = entrées impayées : le paiement FIFO marque les entrées
        // « paid », les soustraire en plus en compterait deux fois (solde négatif).
        return round((float) $query->sum('amount'), 2);
    }

    private function summaryBeneficiary(
        string $id,
        string $type,
        string $name,
        ?string $kind,
        ?string $commissionType,
        mixed $commissionValue,
        string $search,
    ): ?array {
        if ($search !== '' && strpos(strtolower($name), $search) === false) {
            return null;
        }

        $owed = (float) CommissionEntry::query()
            ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
            ->where($type === 'seller_profile' ? 'seller_profile_id' : 'beneficiary_commercial_id', $id)
            ->sum('amount');

        $paid = (float) CommissionPayment::query()
            ->where('rule', 'commission_payment')
            ->where($type === 'seller_profile' ? 'seller_profile_id' : 'commercial_id', $id)
            ->sum('amount');

        return [
            'id' => $id,
            'type' => $type,
            'name' => $name,
            'kind' => $kind,
            'commission_type' => $commissionType,
            'commission_value' => $commissionValue,
            'total_owed' => round($owed, 2),
            'total_paid' => round($paid, 2),
            // Solde restant = entrées impayées. Les versements sont marqués FIFO sur
            // les entrées (paid) : les soustraire en plus les compterait deux fois.
            'balance' => round($owed, 2),
        ];
    }

    private function validateRulePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'beneficiary_commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'beneficiary_seller_profile_id' => ['nullable', 'uuid', 'exists:seller_profiles,id'],
            'scope_country_id' => ['nullable', 'uuid', 'exists:countries,id'],
            'scope_agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'scope_department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'service_id' => ['nullable', 'uuid', 'exists:services,id'],
            'course_id' => ['nullable', 'uuid', 'exists:courses,id'],
            'trigger_event' => ['required', 'string', 'in:on_sale,on_payment,on_full_payment'],
            'formula_type' => ['required', 'string', 'in:percent,fixed,tiered'],
            'percent_value' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'tiers_json' => ['nullable', 'array'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
        ]);
    }
}