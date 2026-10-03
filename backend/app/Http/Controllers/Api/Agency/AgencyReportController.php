<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Services\AgencyAccessService;
use App\Services\AgencyReportService;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Dashboard et rapports du département Agency. */
class AgencyReportController extends Controller
{
    public function __construct(
        private readonly AgencyReportService $reports,
        private readonly AgencyAccessService $access,
        private readonly ScopeService $scope,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        if (! empty($data['agency_id'])) {
            abort_unless($this->access->canAccessAgency($request->user(), $data['agency_id']), 403, 'Agence hors de votre périmètre.');
        }

        $from = Carbon::parse($data['from'] ?? today()->startOfMonth()->toDateString());
        $to = Carbon::parse($data['to'] ?? today()->toDateString());

        return response()->json($this->reports->report(
            $data['department_id'] ?? null,
            $data['agency_id'] ?? null,
            $from,
            $to,
            $this->scope->agencyIds($request->user()),
        ));
    }
}
