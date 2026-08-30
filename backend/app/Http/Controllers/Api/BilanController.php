<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Services\BilanService;
use App\Services\ScopeService;
use App\Support\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenApi\Attributes as OA;

class BilanController extends Controller
{
    public function __construct(private readonly BilanService $bilanService) {}

    /**
     * Agences autorisées, restreintes à un pays si demandé (null = toutes).
     *
     * @return array<int, string>|null
     */
    private function scopedAgencyIds(Request $request, ?string $countryId): ?array
    {
        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        if (! $countryId) {
            return $agencyIds;
        }

        $countryAgencyIds = Agency::query()
            ->where('country_id', $countryId)
            ->whereNull('deleted_at')
            ->pluck('id');

        if ($agencyIds !== null) {
            $countryAgencyIds = $countryAgencyIds->intersect($agencyIds)->values();
        }

        return $countryAgencyIds->isEmpty() ? [] : $countryAgencyIds->all();
    }

    #[OA\Get(
        path: '/api/bilans',
        summary: 'Bilan du jour — agence unique ou globale',
        tags: ['Bilan du jour'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'date', in: 'query', description: 'Jour (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bilan du jour'),
        ]
    )]
    public function dailyBilan(Request $request): JsonResponse
    {
        $date = $request->date('date') ?? Carbon::today();
        $agencyId = $request->input('agency_id');
        $agencyIds = $this->scopedAgencyIds($request, $request->input('country_id'));

        if ($agencyId) {
            if ($agencyIds !== null && ! in_array($agencyId, $agencyIds, true)) {
                abort(403, 'Cette agence est hors de votre périmètre.');
            }

            return response()->json(
                $this->bilanService->daily($date, $agencyId)
            );
        }

        return response()->json(
            $this->bilanService->consolidated($date, $agencyIds)
        );
    }

    #[OA\Get(
        path: '/api/bilans/period',
        summary: 'Bilan sur une plage de dates',
        tags: ['Bilan du jour'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bilan période'),
        ]
    )]
    public function period(Request $request): JsonResponse
    {
        $from = Period::from($request, Carbon::today());
        $to = Period::to($request, $from->copy()->endOfDay());
        $agencyId = $request->input('agency_id');
        $agencyIds = $this->scopedAgencyIds($request, $request->input('country_id'));

        if ($agencyId && $agencyIds !== null && ! in_array($agencyId, $agencyIds, true)) {
            abort(403, 'Cette agence est hors de votre périmètre.');
        }

        return response()->json(
            $this->bilanService->period($from, $to, $agencyId, $agencyIds)
        );
    }
}
