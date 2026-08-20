<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BilanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenApi\Attributes as OA;

class BilanController extends Controller
{
    public function __construct(private readonly BilanService $bilanService) {}

    #[OA\Get(
        path: '/api/bilans',
        summary: 'Bilan du jour — agence unique ou globale',
        tags: ['Bilan du jour'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
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

        if ($agencyId) {
            return response()->json(
                $this->bilanService->daily($date, $agencyId)
            );
        }

        return response()->json(
            $this->bilanService->consolidated($date)
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
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bilan période'),
        ]
    )]
    public function period(Request $request): JsonResponse
    {
        $from = $request->date('from') ?? Carbon::today();
        $to = $request->date('to') ?? $from;
        $agencyId = $request->input('agency_id');

        return response()->json(
            $this->bilanService->period($from, $to, $agencyId)
        );
    }
}
