<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CommercialReportService;
use App\Support\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class CommercialReportController extends Controller
{
    public function __construct(private readonly CommercialReportService $reportService) {}

    #[OA\Get(
        path: '/api/commercials/report',
        summary: 'Reporting commercial : ventes, encaissements, commissions, points, prospects',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Filtrer par agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'commercial_id', in: 'query', description: 'Filtrer par commercial/employé', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'kind', in: 'query', description: 'Filtrer par type (commercial|employe)', schema: new OA\Schema(type: 'string', enum: ['commercial', 'employe'])),
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rapport agrégé par commercial'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function report(Request $request): JsonResponse
    {
        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        if ($from->gt($to)) {
            return response()->json(['message' => 'La date de début doit précéder la date de fin.'], 422);
        }

        $allowedAgencyIds = $this->allowedAgencyIds($request);

        $report = $this->reportService->report(
            agencyId: $request->input('agency_id'),
            commercialId: $request->input('commercial_id'),
            kind: $request->input('kind'),
            from: $from,
            to: $to,
            allowedAgencyIds: $allowedAgencyIds,
        );

        return response()->json($report);
    }

    /**
     * Agences autorisées selon le rôle : tout pour la direction, les agences assignées
     * pour le responsable d'agence, sinon aucun (les autres rôles sont bloqués par la permission).
     *
     * @return array<int, string>|null
     */
    private function allowedAgencyIds(Request $request): ?array
    {
        $user = $request->user();

        if (! $user) {
            return [];
        }

        if (in_array($user->role?->name, ['super-admin', 'direction-generale'], true)) {
            return null;
        }

        if ($user->role?->name === 'responsable-agence') {
            return DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->pluck('agency_id')
                ->all();
        }

        return [];
    }
}
