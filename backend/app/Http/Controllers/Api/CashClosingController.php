<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashClosing;
use App\Models\TreasuryAccount;
use App\Services\CashClosingService;
use App\Services\ScopeService;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * T2.8–T2.10 — clôture journalière des caisses.
 */
class CashClosingController extends Controller
{
    public function index(Request $request, ScopeService $scope, CashClosingService $service)
    {
        $data = $request->validate([
            'date' => ['nullable', 'date'],
            'agency_id' => ['nullable', 'uuid'],
            'treasury_account_id' => ['nullable', 'uuid'],
        ]);

        $query = CashClosing::with(['account', 'closer', 'validator'])
            ->visibleTo($request->user())
            ->orderByDesc('closing_date')
            ->orderByDesc('created_at');

        $scope->scopeManagerQuery($query, $request->user());

        if (isset($data['date'])) {
            $query->whereDate('closing_date', Carbon::parse($data['date'])->toDateString());
        }
        if (isset($data['agency_id'])) {
            $query->where('agency_id', $data['agency_id']);
        }
        if (isset($data['treasury_account_id'])) {
            $query->where('treasury_account_id', $data['treasury_account_id']);
        }

        // Détail du jour (entrées, sorties, transferts) à côté des soldes enregistrés.
        return $query->get()->map(fn (CashClosing $closing) => array_merge($closing->toArray(), [
            'breakdown' => $closing->account
                ? $service->dayBreakdown($closing->account, Carbon::parse($closing->closing_date)->toDateString())
                : null,
        ]));
    }

    /**
     * Journée d'une caisse avant clôture : solde initial, entrées, sorties,
     * transferts reçus / envoyés et solde théorique (cahier §2).
     */
    public function day(Request $request, CashClosingService $service, ScopeService $scope)
    {
        $data = $request->validate([
            'treasury_account_id' => ['required', 'uuid'],
            'date' => ['required', 'date'],
        ]);

        $account = TreasuryAccount::with('agency')->findOrFail($data['treasury_account_id']);
        $this->authorize('view', $account);

        $scopeIds = $scope->agencyIds($request->user());
        abort_if(
            $scopeIds !== null && $account->agency_id !== null && ! in_array($account->agency_id, $scopeIds, true),
            403,
            'Cette caisse est hors de votre périmètre.'
        );

        $date = Carbon::parse($data['date'])->toDateString();

        return response()->json(array_merge(
            ['treasury_account_id' => $account->id, 'date' => $date],
            $service->dayBreakdown($account, $date),
        ));
    }

    public function store(Request $request, CashClosingService $service, ScopeService $scope)
    {
        $data = $request->validate([
            'treasury_account_id' => ['required', 'uuid'],
            'closing_date' => ['required', 'date'],
            'actual_balance' => ['required', 'numeric', 'min:0'],
            'justification' => ['nullable', 'string', 'max:2000'],
        ]);

        $account = TreasuryAccount::findOrFail($data['treasury_account_id']);
        $this->authorize('view', $account);

        $scopeIds = $scope->agencyIds($request->user());
        abort_if(
            $scopeIds !== null && $account->agency_id !== null && ! in_array($account->agency_id, $scopeIds, true),
            403,
            'Cette caisse est hors de votre périmètre.'
        );

        return response()->json(
            $service->close(
                $request->user(),
                $account,
                $data['closing_date'],
                (float) $data['actual_balance'],
                $data['justification'] ?? null,
            ),
            201
        );
    }

    public function validateClosing(Request $request, CashClosing $closing, CashClosingService $service, ScopeService $scope)
    {
        $this->authorize('view', $closing->account);

        $scopeIds = $scope->agencyIds($request->user());
        abort_if(
            $scopeIds !== null && $closing->agency_id !== null && ! in_array($closing->agency_id, $scopeIds, true),
            403,
            'Cette clôture est hors de votre périmètre.'
        );

        return $service->validate($closing, $request->user());
    }
}
