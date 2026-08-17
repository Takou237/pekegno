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
        summary: 'Bilan du jour : ventes par service, encaissements cash/mobile, dépenses, solde initial/final',
        tags: ['Bilan du jour'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'date', in: 'query', description: 'Jour (Y-m-d, défaut : aujourd\'hui)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bilan du jour'),
        ]
    )]
    public function dailyBilan(Request $request): JsonResponse
    {
        $date = $request->date('date') ?? Carbon::today();

        return response()->json(
            $this->bilanService->daily($date, $request->input('agency_id'))
        );
    }
}
