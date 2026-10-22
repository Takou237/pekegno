<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\Commercial;
use App\Models\CommissionEntry;
use App\Models\CommissionPayment;
use App\Models\CommissionRule;
use App\Models\Role;
use App\Models\SellerProfile;
use App\Models\TeamMember;
use App\Models\TreasuryAccount;
use App\Models\User;
use App\Services\AccountingService;
use App\Services\CommissionService;
use App\Services\RoleCommissionService;
use App\Services\ScopeService;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OA\Get;
use OpenApi\Attributes as OA;

class CommissionController extends Controller
{
    private const RULE_RELATIONS = [
        'beneficiary', 'sellerProfile.user', 'course:id,name,code', 'service:id,name', 'package:id,name',
        'product:id,name', 'category:id,name', 'roles:id,name', 'scopeAgency', 'scopeCountry', 'scopeDepartment',
    ];

    public function __construct(
        private readonly TreasuryService $treasuryService,
        private readonly AccountingService $accountingService,
        private readonly CommissionService $commissionService,
        private readonly RoleCommissionService $roleCommissions,
    ) {}

    #[OA\Get(path: '/api/commission-rules', summary: 'Lister les règles (dernières versions)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Règles')])]
    public function indexRules(Request $request): JsonResponse
    {
        $query = CommissionRule::query()->with(self::RULE_RELATIONS);

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->input('course_id'));
        }

        if ($request->filled('package_id')) {
            $query->where('package_id', $request->input('package_id'));
        }

        if ($request->boolean('agency_only')) {
            $query->whereNotNull('package_id');
        }

        // Règles par rôle (réglages > commissions) : toutes celles qui portent une assiette.
        if ($request->filled('basis')) {
            $query->where('basis', $request->input('basis'));
        }

        if ($request->filled('role_id')) {
            $query->whereIn('rule_group_id', DB::table('commission_rule_role')->where('role_id', $request->input('role_id'))->select('rule_group_id'));
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
        $roleIds = $data['role_ids'] ?? null;
        unset($data['role_ids']);

        $rule = CommissionRule::create($data + [
            'rule_group_id' => (string) Str::uuid(),
            'version' => 1,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        if ($roleIds !== null) {
            $rule->roles()->sync($roleIds);
        }

        return response()->json($rule->fresh()->load(self::RULE_RELATIONS), 201);
    }

    #[OA\Put(path: '/api/commission-rules/{rule}', summary: 'Modifier → nouvelle version (ancienne désactivée)', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Nouvelle version')])]
    public function updateRule(Request $request, CommissionRule $rule): JsonResponse
    {
        $data = $this->validateRulePayload($request);
        $roleIds = $data['role_ids'] ?? null;
        unset($data['role_ids']);

        $rule->update(['is_active' => false]);

        $newVersion = CommissionRule::create($data + [
            'rule_group_id' => $rule->rule_group_id,
            'version' => $rule->version + 1,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        // Rôles rattachés au groupe : la nouvelle version en hérite.
        if ($roleIds !== null) {
            $newVersion->roles()->sync($roleIds);
        }

        return response()->json($newVersion->fresh()->load(self::RULE_RELATIONS));
    }

    /**
     * Règles attribuées à un rôle (depuis l'onglet Commissions, vue par rôle).
     */
    public function syncRoleRules(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'rule_group_ids' => ['present', 'array'],
            'rule_group_ids.*' => ['uuid', 'exists:commission_rules,rule_group_id'],
        ]);

        DB::transaction(function () use ($role, $validated) {
            DB::table('commission_rule_role')->where('role_id', $role->id)->delete();
            $now = now();
            DB::table('commission_rule_role')->insert(
                collect($validated['rule_group_ids'])->unique()->map(fn ($groupId) => [
                    'rule_group_id' => $groupId,
                    'role_id' => $role->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->values()->all()
            );
        });

        return response()->json(['data' => $role->commissionRuleGroupIds()]);
    }

    /**
     * Calcule les primes périodiques (CA mensuel par paliers, croissance N-1)
     * d'un mois. Relançable : les entrées non validées sont recalculées.
     */
    public function computePeriod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['required', 'date_format:Y-m'],
            'rule_id' => ['nullable', 'uuid', 'exists:commission_rules,id'],
        ]);

        $groupId = isset($validated['rule_id']) ? CommissionRule::whereKey($validated['rule_id'])->value('rule_group_id') : null;

        return response()->json(['data' => $this->roleCommissions->computePeriod($validated['period'], $groupId)]);
    }

    /**
     * Prime manuelle (témoignage, qualité, innovation…) attribuée à un
     * utilisateur dont le rôle porte la règle, dans la fourchette prévue.
     */
    public function awardManual(Request $request, CommissionRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'label' => ['nullable', 'string', 'max:250'],
        ]);

        abort_if($rule->basis !== CommissionRule::BASIS_MANUAL, 422, 'Cette règle n\'est pas une prime manuelle.');

        $user = User::findOrFail($validated['user_id']);
        abort_unless($rule->roles()->where('roles.id', $user->role_id)->exists(), 422, 'Le rôle de cet utilisateur ne porte pas cette règle.');

        $amount = (float) $validated['amount'];
        abort_if($rule->bonus_min !== null && $amount < (float) $rule->bonus_min, 422, 'Montant inférieur au minimum de la prime ('.number_format((float) $rule->bonus_min, 0, ',', ' ').').');
        abort_if($rule->bonus_max !== null && $amount > (float) $rule->bonus_max, 422, 'Montant supérieur au maximum de la prime ('.number_format((float) $rule->bonus_max, 0, ',', ' ').').');

        $entry = $this->roleCommissions->awardManual($rule, $user, $amount, $validated['label'] ?? null, $request->user()->id);

        return response()->json($entry->load(['beneficiaryUser:id,first_name,last_name', 'rule']), 201);
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

    #[Get(path: '/api/commissions/entries', summary: 'Lister les lignes de commission', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Entrées paginées')])]
    public function indexEntries(Request $request): JsonResponse
    {
        $query = CommissionEntry::query()->with(['invoice', 'beneficiary', 'teamMember:id,first_name,last_name', 'beneficiaryUser:id,first_name,last_name,role_id', 'sellerProfile.user', 'rule', 'validator', 'payer']);

        if ($request->filled('status')) {
            $query->ofStatus($request->input('status'));
        }

        // Agency : commissions sur packages / prestations (category = agency).
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('agency_id')) {
            $query->whereHas('invoice', fn ($q) => $q->where('agency_id', $request->input('agency_id')));
        }

        if ($request->filled('beneficiary_commercial_id')) {
            $query->where('beneficiary_commercial_id', $request->input('beneficiary_commercial_id'));
        }

        if ($request->filled('seller_profile_id')) {
            $query->where('seller_profile_id', $request->input('seller_profile_id'));
        }

        if ($request->filled('beneficiary_user_id')) {
            $query->where('beneficiary_user_id', $request->input('beneficiary_user_id'));
        }

        if ($request->filled('period')) {
            $query->where('period', $request->input('period'));
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

        return response()->json($entry->fresh()->load(['invoice', 'beneficiary', 'teamMember:id,first_name,last_name', 'sellerProfile', 'rule', 'validator']));
    }

    #[OA\Post(path: '/api/commissions/entries/{entry}/pay', summary: 'Payer (validated → paid) avec sortie de trésorerie', tags: ['Commissions'], security: [['sanctum' => []]], responses: [new OA\Response(response: 200, description: 'Payée')])]
    public function payEntry(Request $request, CommissionEntry $entry): JsonResponse
    {
        abort_if($entry->status !== CommissionEntry::STATUS_VALIDATED, 422, 'Impossible de payer cette commission (statut actuel : '.$entry->status.').');

        $validated = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', 'in:especes,orange_money,mobile_money'],
        ]);

        $entryAmount = (float) $entry->amount;
        $amount = $request->filled('amount') ? (float) $validated['amount'] : $entryAmount;

        abort_if($amount <= 0 || $amount > $entryAmount + 0.005, 422, 'Le montant à payer doit être supérieur à 0 et ne peut excéder le montant de la commission ('.number_format($entryAmount, 2).' FCFA).');

        $paymentMethod = $validated['payment_method'] ?? null;

        $actorId = $request->user()->id;

        $sellerProfile = $entry->sellerProfile;
        $commercial = $entry->beneficiary;
        $teamMember = $entry->teamMember;

        $beneficiaryUser = $entry->beneficiaryUser;

        $agencyId = $sellerProfile?->agency_id ?? $commercial?->agency_id ?? $teamMember?->agency_id
            ?? ($beneficiaryUser ? $this->userAgencyId($beneficiaryUser) : null);
        $scopeIds = app(ScopeService::class)->agencyIds($request->user());
        abort_if($scopeIds !== null && ! in_array($agencyId, $scopeIds, true), 403, 'Ce bénéficiaire est hors de votre périmètre.');
        $beneficiaryName = $sellerProfile?->full_name
            ?? ($teamMember ? $teamMember->full_name : null)
            ?? ($beneficiaryUser && ! $commercial ? trim("{$beneficiaryUser->first_name} {$beneficiaryUser->last_name}") : null)
            ?? trim("{$commercial?->first_name} {$commercial?->last_name}")
            ?: 'Bénéficiaire';

        // Aucun compte fourni : on débite la caisse par défaut de l'agence du bénéficiaire.
        $account = null;

        if ($agencyId) {
            $account = TreasuryAccount::query()
                ->where('agency_id', $agencyId)
                ->where('type', 'cash')
                ->where('is_active', true)
                ->orderBy('created_at')
                ->first();
        }

        DB::transaction(function () use ($entry, $entryAmount, $amount, $paymentMethod, $actorId, $sellerProfile, $commercial, $agencyId, $beneficiaryName, $account) {
            $paidEntryId = $entry->id;

            if ($amount >= $entryAmount - 0.005) {
                // 1. Marquer l'entrée payée.
                $entry->transitionTo(CommissionEntry::STATUS_PAID, $actorId);
            } else {
                // Paiement partiel de l'entrée : scission.
                $paidEntry = $this->splitAndPayEntry($entry, $amount, $actorId);
                $paidEntryId = $paidEntry->id;
            }

            $reference = 'COMM-'.strtoupper(substr((string) ($sellerProfile?->id ?? $commercial?->id), 0, 8)).'-'.now()->format('YmdHis');

            // 2. Paiement enregistré (traçabilité vers la sortie).
            $commissionPayment = CommissionPayment::create([
                'commercial_id' => $commercial?->id,
                'seller_profile_id' => $sellerProfile?->id,
                'beneficiary_user_id' => $commercial || $sellerProfile ? null : $entry->beneficiary_user_id,
                'commission_entry_id' => $paidEntryId,
                'treasury_account_id' => $account?->id,
                'amount' => $amount,
                'base_amount' => $amount,
                'rule' => 'commission_payment',
                'payment_method' => $paymentMethod,
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
                AccountingTransaction::create([
                    'number' => $this->accountingService->nextNumber(),
                    'agency_id' => $agencyId,
                    'category_id' => $category->id,
                    'type' => 'expense',
                    'label' => "Commission — {$beneficiaryName}",
                    'reference' => $reference,
                    'amount' => $amount,
                    'transacted_at' => now(),
                    'operator_id' => $actorId,
                    'beneficiary' => $beneficiaryName,
                ]);
            }
        });

        return response()->json($entry->fresh()->load(['invoice', 'beneficiary', 'teamMember:id,first_name,last_name', 'sellerProfile', 'rule', 'payer']));
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
        // Utilisateur rattaché à des agences (caissière, responsable...) : seulement
        // les bénéficiaires de son périmètre.
        $scopeIds = app(ScopeService::class)->agencyIds($request->user());

        $sellers = SellerProfile::query()
            ->with('user')
            ->where('is_active', true)
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->when($scopeIds !== null, fn ($q) => $q->whereIn('agency_id', $scopeIds))
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
            ->when($scopeIds !== null, fn ($q) => $q->whereIn('agency_id', $scopeIds))
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

        $teamMembers = TeamMember::query()
            ->where('is_active', true)
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->when($scopeIds !== null, fn ($q) => $q->whereIn('agency_id', $scopeIds))
            ->get()
            ->map(fn (TeamMember $m) => $this->summaryBeneficiary(
                id: $m->id,
                type: 'team_member',
                name: $m->full_name ?: ($m->email ?? 'Équipier'),
                kind: 'equipier',
                commissionType: $m->commission_type,
                commissionValue: $m->commission_value,
                search: $search,
            ))
            ->filter()
            ->values();

        // Bénéficiaires de règles par rôle sans profil commercial (chefs,
        // community managers, caissiers…).
        $userIds = CommissionEntry::query()
            ->whereNotNull('beneficiary_user_id')
            ->whereNull('beneficiary_commercial_id')
            ->whereNull('seller_profile_id')
            ->distinct()
            ->pluck('beneficiary_user_id');

        $users = User::query()
            ->with('role:id,name')
            ->whereIn('id', $userIds)
            ->get()
            ->filter(function (User $u) use ($agencyId, $scopeIds) {
                $userAgency = $this->userAgencyId($u);
                if ($agencyId && $userAgency !== $agencyId) {
                    return false;
                }

                return $scopeIds === null || in_array($userAgency, $scopeIds, true);
            })
            ->map(fn (User $u) => $this->summaryBeneficiary(
                id: $u->id,
                type: 'user',
                name: trim("{$u->first_name} {$u->last_name}") ?: $u->username,
                kind: $u->role?->name,
                commissionType: null,
                commissionValue: null,
                search: $search,
            ))
            ->filter()
            ->values();

        $all = collect()
            ->merge($sellers)
            ->merge($commercials)
            ->merge($teamMembers)
            ->merge($users)
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
            'beneficiary_type' => ['required', 'string', 'in:seller_profile,commercial,team_member,user'],
            'beneficiary_id' => ['required', 'uuid'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'treasury_account_id' => ['nullable', 'uuid', 'exists:treasury_accounts,id'],
            'payment_method' => ['nullable', 'string', 'in:especes,orange_money,mobile_money'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $amount = (float) $validated['amount'];
        $actorId = $request->user()->id;

        $sellerProfile = null;
        $commercial = null;
        $teamMember = null;
        $beneficiaryUser = null;
        $agencyId = null;
        $beneficiaryName = 'Bénéficiaire';

        if ($validated['beneficiary_type'] === 'seller_profile') {
            $sellerProfile = SellerProfile::with('user')->where('is_active', true)->findOrFail($validated['beneficiary_id']);
            $agencyId = $sellerProfile->agency_id;
            $beneficiaryName = $sellerProfile->full_name;
        } elseif ($validated['beneficiary_type'] === 'team_member') {
            $teamMember = TeamMember::where('is_active', true)->findOrFail($validated['beneficiary_id']);
            $agencyId = $teamMember->agency_id;
            $beneficiaryName = $teamMember->full_name ?: 'Équipier';
        } elseif ($validated['beneficiary_type'] === 'user') {
            $beneficiaryUser = User::findOrFail($validated['beneficiary_id']);
            $agencyId = $this->userAgencyId($beneficiaryUser);
            $beneficiaryName = trim("{$beneficiaryUser->first_name} {$beneficiaryUser->last_name}") ?: $beneficiaryUser->username;
        } else {
            $commercial = Commercial::with('user')->where('is_active', true)->findOrFail($validated['beneficiary_id']);
            $agencyId = $commercial->agency_id;
            $beneficiaryName = trim("{$commercial->first_name} {$commercial->last_name}")
                ?: ($commercial->user?->name ?? $commercial->email ?? 'Commercial');
        }

        $scopeIds = app(ScopeService::class)->agencyIds($request->user());
        abort_if($scopeIds !== null && ! in_array($agencyId, $scopeIds, true), 403, 'Ce bénéficiaire est hors de votre périmètre.');

        $balance = $this->balanceForBeneficiary($sellerProfile, $commercial, $teamMember, $beneficiaryUser);

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

        $payment = DB::transaction(function () use ($sellerProfile, $commercial, $teamMember, $beneficiaryUser, $amount, $account, $validated, $actorId, $agencyId, $beneficiaryName) {
            // 1. Marquage FIFO des entrées couvertes par ce paiement (paiement partiel possible).
            $entriesQuery = CommissionEntry::query()
                ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
                ->orderBy('created_at')
                ->orderBy('id');

            if ($sellerProfile) {
                $entriesQuery->where('seller_profile_id', $sellerProfile->id);
            } elseif ($teamMember) {
                $entriesQuery->where('beneficiary_team_member_id', $teamMember->id);
            } elseif ($beneficiaryUser) {
                $this->userOnlyEntries($entriesQuery, $beneficiaryUser->id);
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
                } else {
                    $paidEntry = $this->splitAndPayEntry($entry, $remaining, $actorId);
                    $coveredEntry ??= $paidEntry->id;
                    $remaining = 0.0;
                    break;
                }
            }

            $reference = 'COMM-'.strtoupper(substr($sellerProfile?->id ?? $commercial?->id ?? $teamMember?->id ?? $beneficiaryUser?->id ?? '', 0, 8)).'-'.now()->format('YmdHis');

            // 2. Paiement enregistré.
            $commissionPayment = CommissionPayment::create([
                'commercial_id' => $commercial?->id,
                'seller_profile_id' => $sellerProfile?->id,
                'beneficiary_team_member_id' => $teamMember?->id,
                'beneficiary_user_id' => $beneficiaryUser?->id,
                'commission_entry_id' => $coveredEntry,
                'treasury_account_id' => $account?->id,
                'amount' => $amount,
                'base_amount' => $amount,
                'rule' => 'commission_payment',
                'payment_method' => $validated['payment_method'] ?? null,
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
                AccountingTransaction::create([
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

        $payment->load(['commercial.user', 'sellerProfile.user', 'teamMember', 'beneficiaryUser:id,first_name,last_name', 'treasuryAccount', 'commissionEntry']);

        return response()->json($payment, 201);
    }

    private function balanceForBeneficiary(?SellerProfile $sellerProfile, ?Commercial $commercial, ?TeamMember $teamMember = null, ?User $user = null): float
    {
        $query = CommissionEntry::query()
            ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED]);

        if ($sellerProfile) {
            $query->where('seller_profile_id', $sellerProfile->id);
        } elseif ($teamMember) {
            $query->where('beneficiary_team_member_id', $teamMember->id);
        } elseif ($user) {
            $this->userOnlyEntries($query, $user->id);
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

        $entryColumn = match ($type) {
            'seller_profile' => 'seller_profile_id',
            'team_member' => 'beneficiary_team_member_id',
            'user' => 'beneficiary_user_id',
            default => 'beneficiary_commercial_id',
        };
        $paymentColumn = match ($type) {
            'seller_profile' => 'seller_profile_id',
            'team_member' => 'beneficiary_team_member_id',
            'user' => 'beneficiary_user_id',
            default => 'commercial_id',
        };

        $owedQuery = CommissionEntry::query()
            ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED]);
        if ($type === 'user') {
            $this->userOnlyEntries($owedQuery, $id);
        } else {
            $owedQuery->where($entryColumn, $id);
        }
        $owed = (float) $owedQuery->sum('amount');

        $paid = (float) CommissionPayment::query()
            ->where('rule', 'commission_payment')
            ->where($paymentColumn, $id)
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

    private function splitAndPayEntry(CommissionEntry $entry, float $paidAmount, string $actorId): CommissionEntry
    {
        $paidAmount = round($paidAmount, 2);
        $entryAmount = (float) $entry->amount;
        $remainingAmount = round($entryAmount - $paidAmount, 2);

        $paidEntry = CommissionEntry::create([
            'invoice_id' => $entry->invoice_id,
            'invoice_payment_id' => $entry->invoice_payment_id,
            'commission_rule_id' => $entry->commission_rule_id,
            'rule_snapshot' => $entry->rule_snapshot,
            'seller_profile_id' => $entry->seller_profile_id,
            'beneficiary_commercial_id' => $entry->beneficiary_commercial_id,
            'beneficiary_team_member_id' => $entry->beneficiary_team_member_id,
            'beneficiary_user_id' => $entry->beneficiary_user_id,
            'period' => $entry->period,
            'category' => $entry->category,
            'product_id' => $entry->product_id,
            'product_type' => $entry->product_type,
            'base_amount' => $paidAmount,
            'amount' => $paidAmount,
            'status' => CommissionEntry::STATUS_PAID,
            'validated_by' => $actorId,
            'validated_at' => $entry->validated_at ?? now(),
            'paid_by' => $actorId,
            'paid_at' => now(),
        ]);

        $entry->amount = $remainingAmount;
        $entry->base_amount = max(0, round((float) $entry->base_amount - $paidAmount, 2));
        $entry->save();

        return $paidEntry;
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
            // Agency (D13) : taux par package.
            'package_id' => ['nullable', 'uuid', 'exists:subscription_packs,id'],
            'trigger_event' => ['required', 'string', 'in:on_sale,on_payment,on_full_payment'],
            'formula_type' => ['required', 'string', 'in:percent,fixed,tiered'],
            'percent_value' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'tiers_json' => ['nullable', 'array'],
            'tiers_json.*.min' => ['nullable', 'numeric', 'min:0'],
            'tiers_json.*.percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tiers_json.*.fixed_bonus' => ['nullable', 'numeric', 'min:0'],
            'tiers_json.*.pot_bonus' => ['nullable', 'numeric', 'min:0'],
            'tiers_json.*.bonus_requires_recovery' => ['nullable', 'boolean'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            // Règles par rôle.
            'basis' => ['nullable', 'string', 'in:'.implode(',', CommissionRule::BASES)],
            'target_kind' => ['nullable', 'string', 'in:'.implode(',', CommissionRule::TARGET_KINDS)],
            'description' => ['nullable', 'string', 'max:2000'],
            'product_id' => ['nullable', 'uuid', 'exists:products,id'],
            'category_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'renewal_number' => ['nullable', 'integer', 'min:1', 'max:120'],
            'renewal_on_time' => ['nullable', 'boolean'],
            'revenue_scope' => ['nullable', 'string', 'in:'.implode(',', CommissionRule::REVENUE_SCOPES)],
            'min_recovery_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'recovery_period' => ['nullable', 'string', 'in:'.implode(',', CommissionRule::RECOVERY_PERIODS)],
            'growth_multiplier' => ['nullable', 'numeric', 'min:0'],
            'max_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'bonus_min' => ['nullable', 'numeric', 'min:0'],
            'bonus_max' => ['nullable', 'numeric', 'min:0', 'gte:bonus_min'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['uuid', 'exists:roles,id'],
        ]) + ['basis' => CommissionRule::BASIS_SALE, 'revenue_scope' => 'own', 'recovery_period' => 'previous_month'];
    }

    /** Entrées d'un bénéficiaire « utilisateur » (sans profil commercial ni vendeur). */
    private function userOnlyEntries($query, string $userId): void
    {
        $query->where('beneficiary_user_id', $userId)
            ->whereNull('beneficiary_commercial_id')
            ->whereNull('seller_profile_id');
    }

    /** Agence de rattachement d'un utilisateur (agence dont il est chef, sinon la première). */
    private function userAgencyId(User $user): ?string
    {
        return DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->orderByDesc('is_primary')
            ->value('agency_id');
    }
}
