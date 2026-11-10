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

        $query = CashClosing::with(['account.agency:id,name', 'closer', 'validator'])
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

        // Détail de la journée clôturée (entrées, sorties, transferts).
        return $query->get()->map(fn (CashClosing $closing) => array_merge($closing->toArray(), [
            'breakdown' => $closing->account
                ? ($closing->closed_at && ! $closing->reopened_at?->equalTo($closing->created_at)
                    ? $service->between($closing->account, $closing->opened_at, $closing->closed_at)
                    : $service->dayBreakdown($closing->account, Carbon::parse($closing->closing_date)->toDateString()))
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
        ]);

        $account = TreasuryAccount::with('agency')->findOrFail($data['treasury_account_id']);
        $this->authorize('view', $account);

        $scopeIds = $scope->agencyIds($request->user());
        abort_if(
            $scopeIds !== null && $account->agency_id !== null && ! in_array($account->agency_id, $scopeIds, true),
            403,
            'Cette caisse est hors de votre périmètre.'
        );

        // Journée en cours (depuis la dernière clôture) ou journée clôturée.
        return response()->json(array_merge(
            ['treasury_account_id' => $account->id],
            $service->currentJourney($account),
        ));
    }

    public function store(Request $request, CashClosingService $service, ScopeService $scope)
    {
        $data = $request->validate([
            'treasury_account_id' => ['required', 'uuid'],
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
                (float) $data['actual_balance'],
                $data['justification'] ?? null,
            ),
            201
        );
    }

    /** Réouverture de la caisse : une nouvelle journée commence. */
    public function reopen(Request $request, TreasuryAccount $account, CashClosingService $service, ScopeService $scope)
    {
        $this->authorize('view', $account);

        $scopeIds = $scope->agencyIds($request->user());
        abort_if(
            $scopeIds !== null && $account->agency_id !== null && ! in_array($account->agency_id, $scopeIds, true),
            403,
            'Cette caisse est hors de votre périmètre.'
        );

        return response()->json($service->reopen($request->user(), $account));
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
