<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountingCategory;
use App\Models\AccountingTransaction;
use App\Models\CommissionEntry;
use App\Models\CommissionPayment;
use App\Models\SellerProfile;
use App\Models\TreasuryAccount;
use App\Services\AccountingService;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class SellerProfileController extends Controller
{
    public function __construct(
        private readonly TreasuryService $treasuryService,
        private readonly AccountingService $accountingService,
    ) {}
    public function index(Request $request): JsonResponse
    {
        $query = SellerProfile::with('user');

        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->input('agency_id'));
        }

        if ($request->filled('kind')) {
            $query->where('kind', $request->input('kind'));
        }

        $profiles = $query->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return response()->json($profiles);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'agency_id' => 'required|exists:agencies,id',
            'kind' => 'required|string|in:trainer,commercial,employee',
            'commission_type' => 'required|string|in:percent,fixed,none',
            'commission_value' => 'required|numeric|min:0',
        ]);

        $existing = SellerProfile::where('user_id', $validated['user_id'])
            ->where('agency_id', $validated['agency_id'])
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Ce profil vendeur existe déjà pour cette agence.'], 409);
        }

        $profile = SellerProfile::create($validated);
        $profile->load('user');

        return response()->json($profile, 201);
    }

    public function show(SellerProfile $sellerProfile): JsonResponse
    {
        $sellerProfile->load('user');

        return response()->json($sellerProfile);
    }

    public function update(Request $request, SellerProfile $sellerProfile): JsonResponse
    {
        $validated = $request->validate([
            'kind' => 'sometimes|string|in:trainer,commercial,employee',
            'commission_type' => 'sometimes|string|in:percent,fixed,none',
            'commission_value' => 'sometimes|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $sellerProfile->update($validated);
        $sellerProfile->load('user');

        return response()->json($sellerProfile);
    }

    public function destroy(SellerProfile $sellerProfile): JsonResponse
    {
        $sellerProfile->delete();

        return response()->json(null, 204);
    }

    /**
     * Tableau de bord commissions d'un vendeur.
     */
    public function commissions(SellerProfile $sellerProfile): JsonResponse
    {
        $totalTraining = $sellerProfile->totalByCategory('training');
        $totalService = $sellerProfile->totalByCategory('service');
        $totalPaid = (float) $sellerProfile->commissionPayments()
            ->where('rule', 'commission_payment')
            ->sum('amount');
        $totalOwed = $totalTraining + $totalService;
        // Solde restant = entrées impayées ; le paiement marque les entrées « paid »
        // (FIFO), soustraire aussi les versements les compterait deux fois.
        $balance = round($totalOwed, 2);

        $entries = $sellerProfile->commissionEntries()
            ->with('invoice')
            ->orderByDesc('created_at')
            ->paginate(15);

        $payments = $sellerProfile->commissionPayments()
            ->with('commissionEntry')
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json([
            'summary' => [
                'total_training' => $totalTraining,
                'total_service' => $totalService,
                'total_owed' => $totalOwed,
                'total_paid' => $totalPaid,
                'balance' => $balance,
            ],
            'entries' => $entries,
            'payments' => $payments,
        ]);
    }

    /**
     * Enregistrer un paiement de commission.
     * Crée une sortie de trésorerie + écriture comptable (expense).
     */
    public function payCommission(Request $request, SellerProfile $sellerProfile): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'commission_entry_id' => 'nullable|exists:commission_entries,id',
            'treasury_account_id' => 'nullable|exists:treasury_accounts,id',
            'note' => 'nullable|string',
        ]);

        $amount = (float) $validated['amount'];
        $balance = $sellerProfile->balance();

        if ($amount > $balance) {
            return response()->json([
                'message' => "Le montant ({$amount}) dépasse le solde disponible ({$balance}).",
            ], 422);
        }

        $account = null;

        if ($validated['treasury_account_id'] ?? null) {
            $account = TreasuryAccount::where('id', $validated['treasury_account_id'])
                ->where('is_active', true)
                ->first();

            if (! $account) {
                return response()->json(['message' => 'Compte de trésorerie inexistant ou inactif.'], 422);
            }
        } elseif ($sellerProfile->agency_id) {
            // Aucun compte fourni : on débite la caisse par défaut de l'agence du vendeur.
            $account = TreasuryAccount::query()
                ->where('agency_id', $sellerProfile->agency_id)
                ->where('type', 'cash')
                ->where('is_active', true)
                ->orderBy('created_at')
                ->first();
        }

        $payment = DB::transaction(function () use ($sellerProfile, $validated, $amount, $account) {
            $commissionPayment = CommissionPayment::create([
                'seller_profile_id' => $sellerProfile->id,
                'commission_entry_id' => $validated['commission_entry_id'] ?? null,
                'treasury_account_id' => $account?->id,
                'amount' => $amount,
                'base_amount' => $amount,
                'rule' => 'commission_payment',
                'invoice_total' => 0,
                'created_by' => auth()->id(),
            ]);

            // Marquer les entrées commission payées (FIFO) sans jamais dépasser le montant.
            $remaining = $amount;

            if (! empty($validated['commission_entry_id'])) {
                $entry = CommissionEntry::find($validated['commission_entry_id']);

                if ($entry && $entry->seller_profile_id === $sellerProfile->id
                    && in_array($entry->status, [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED], true)) {
                    $entry->transitionTo(CommissionEntry::STATUS_PAID, auth()->id());
                    $remaining = round($remaining - (float) $entry->amount, 2);
                }
            }

            if ($remaining > 0.005) {
                $entries = $sellerProfile->commissionEntries()
                    ->whereIn('status', [CommissionEntry::STATUS_CALCULATED, CommissionEntry::STATUS_VALIDATED])
                    ->orderBy('created_at')
                    ->orderBy('id')
                    ->limit(500)
                    ->get();

                foreach ($entries as $entry) {
                    if ($remaining <= 0.005) {
                        break;
                    }

                    $entryAmount = (float) $entry->amount;

                    if ($remaining >= $entryAmount - 0.005) {
                        $entry->transitionTo(CommissionEntry::STATUS_PAID, auth()->id());
                        $remaining = round($remaining - $entryAmount, 2);
                    }
                }
            }

            // Sortie de trésorerie (si un compte a été résolu)
            if ($account) {
                $this->treasuryService->recordMovement(
                    account: $account,
                    direction: 'out',
                    amount: $amount,
                    label: "Commission vendeur — {$sellerProfile->full_name}",
                    sourceType: 'commission_payment',
                    sourceId: $commissionPayment->id,
                    category: 'commission',
                    reference: "COMM-{$sellerProfile->id}-" . now()->format('YmdHis'),
                    createdBy: auth()->id(),
                );
            }

            // Écriture comptable (expense) — catégorie dédiée « Commissions ».
            $category = $this->accountingService->commissionExpenseCategory();

            if ($category && $sellerProfile->agency_id) {
                AccountingTransaction::create([
                    'number' => $this->accountingService->nextNumber(),
                    'agency_id' => $sellerProfile->agency_id,
                    'category_id' => $category->id,
                    'type' => 'expense',
                    'label' => "Commission vendeur — {$sellerProfile->full_name}",
                    'reference' => "COMM-{$sellerProfile->id}-" . now()->format('YmdHis'),
                    'amount' => $amount,
                    'transacted_at' => now(),
                    'operator_id' => auth()->id(),
                    'note' => $validated['note'] ?? null,
                    'beneficiary' => $sellerProfile->full_name,
                ]);
            }

            return $commissionPayment;
        });

        $payment->load('commissionEntry', 'treasuryAccount');

        return response()->json($payment, 201);
    }
}
