<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Department;
use App\Services\FinancialMetricsService;
use App\Services\ScopeService;
use App\Support\GroupCurrency;
use App\Support\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Endpoint de synthèse financière unique (T1.7).
 *
 * Toutes les pages doivent à terme consommer cette route plutôt que recalculer
 * un CA local. Les filtres sont les mêmes que les tableaux de bord :
 * période (from/to), pays, ville, agence, département, commercial.
 */
class MetricsController extends Controller
{
    public function __construct(private readonly FinancialMetricsService $metrics) {}

    public function summary(Request $request): JsonResponse
    {
        [$from, $to, $agencyIds, $convert, $commercialId, $department] = $this->resolveScope($request);

        $summary = $this->metrics->summary($from, $to, $agencyIds, $convert, $commercialId, $department);

        return response()->json([
            'period' => ['from' => $from->toISOString(), 'to' => $to->toISOString()],
            'filters' => [
                'country_id' => $request->input('country_id'),
                'city_id' => $request->input('city_id'),
                'agency_id' => $request->input('agency_id'),
                'department_id' => $request->input('department_id'),
                'commercial_id' => $commercialId,
            ],
            'currency_code' => $this->currencyCode($request),
            'converted' => $convert,
        ] + $summary);
    }

    public function breakdown(Request $request): JsonResponse
    {
        [$from, $to, $agencyIds, $convert, $commercialId, $department] = $this->resolveScope($request);

        return response()->json([
            'period' => ['from' => $from->toISOString(), 'to' => $to->toISOString()],
            'currency_code' => $this->currencyCode($request),
            'converted' => $convert,
            'by_agency' => $this->metrics->byAgency($from, $to, $agencyIds, $convert, $commercialId, $department)->values(),
            'by_mode' => $this->metrics->byMode($from, $to, $agencyIds, $convert, $commercialId, $department),
            'by_category' => $this->metrics->byCategory($from, $to, $agencyIds, $convert, $commercialId, $department)->values(),
            'by_commercial' => $this->metrics->byCommercial($from, $to, $agencyIds, $convert, $department),
        ]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon, 2: array<int, string>|null, 3: bool, 4: ?string, 5: ?Department}
     */
    private function resolveScope(Request $request): array
    {
        $from = Period::from($request, now()->startOfMonth());
        $to = Period::to($request);

        $scope = app(ScopeService::class);
        $allowed = $scope->agencyIds($request->user());

        $agencyIds = $allowed;

        if ($request->filled('agency_id')) {
            $agencyId = (string) $request->input('agency_id');
            abort_if($allowed !== null && ! in_array($agencyId, $allowed, true), 403, 'Cette agence est hors de votre périmètre.');
            $agencyIds = [$agencyId];
        } else {
            if ($request->filled('country_id')) {
                $countryIds = Agency::idsForCountry((string) $request->input('country_id'));
                $agencyIds = $agencyIds === null ? $countryIds : array_values(array_intersect($agencyIds, $countryIds));
            }

            if ($request->filled('city_id')) {
                $cityIds = Agency::where('city_id', $request->input('city_id'))->pluck('id')->all();
                $agencyIds = $agencyIds === null ? $cityIds : array_values(array_intersect($agencyIds, $cityIds));
            }
        }

        $department = null;
        if ($request->filled('department_id')) {
            $department = Department::findOrFail($request->input('department_id'));
            abort_if($allowed !== null && ! in_array($department->agency_id, $allowed, true), 403, 'Ce département est hors de votre périmètre.');
        }

        // Monnaie locale dès qu'un pays / une ville / une agence est sélectionné.
        $convert = ! $request->filled('country_id')
            && ! $request->filled('city_id')
            && ! $request->filled('agency_id');

        return [$from, $to, $agencyIds, $convert, $request->input('commercial_id'), $department];
    }

    private function currencyCode(Request $request): string
    {
        if ($request->filled('agency_id')) {
            return GroupCurrency::currencyForAgency((string) $request->input('agency_id'));
        }

        if ($request->filled('country_id')) {
            return GroupCurrency::currencyForCountry((string) $request->input('country_id'));
        }

        return GroupCurrency::code();
    }
}
