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
    public function index(Request $request, ScopeService $scope)
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

        return $query->get();
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

    public function validateClosing(Request $request, CashClosing $closing, CashClosingService $service)
    {
        $this->authorize('view', $closing->account);

        return $service->validate($closing, $request->user());
    }
}
