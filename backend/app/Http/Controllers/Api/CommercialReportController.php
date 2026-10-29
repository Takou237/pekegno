<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commercial;
use App\Models\User;
use App\Services\CommercialMonthlyReportService;
use App\Services\CommercialReportService;
use App\Support\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class CommercialReportController extends Controller
{
    public function __construct(
        private readonly CommercialReportService $reportService,
        private readonly CommercialMonthlyReportService $monthlyService,
    ) {}

    /**
     * Options de vendeurs du rapport mensuel : tous les comptes staff, même
     * ceux qui n'ont pas encore de fiche commercial/employé.
     */
    public function options(Request $request): JsonResponse
    {
        $allowedAgencyIds = $this->allowedAgencyIds($request);

        // Rapport ouvert depuis l'espace d'une agence : vendeurs de cette agence
        // uniquement (toujours dans le périmètre autorisé).
        if ($request->filled('agency_id')) {
            $agencyId = (string) $request->query('agency_id');
            $allowedAgencyIds = $allowedAgencyIds === null || in_array($agencyId, $allowedAgencyIds, true)
                ? [$agencyId]
                : [];
        }

        $users = User::query()
            ->with(['role:id,name', 'commercialProfile.agency:id,name', 'assignments:id,name'])
            ->whereHas('role', fn ($query) => $query->where('name', '!=', 'client'))
            ->when($allowedAgencyIds !== null, function ($query) use ($allowedAgencyIds) {
                $query->where(function ($scope) use ($allowedAgencyIds) {
                    $scope->whereHas('assignments', fn ($agency) => $agency->whereIn('agencies.id', $allowedAgencyIds))
                        ->orWhereHas('commercialProfile', fn ($profile) => $profile->whereIn('agency_id', $allowedAgencyIds));
                });
            })
            ->when($request->filled('q'), function ($query) use ($request) {
                $search = trim((string) $request->query('q'));
                $query->where(fn ($matches) => $matches
                    ->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%"));
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(function (User $user) {
                $agency = $user->commercialProfile?->agency ?? $user->assignments->first();

                return [
                    'id' => $user->id,
                    'user_id' => $user->id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'kind' => $user->role?->name === 'commercial' ? 'commercial' : 'employe',
                    'role' => $user->role?->name,
                    'agency' => $agency ? ['name' => $agency->name] : null,
                ];
            })
            ->values();

        return response()->json($users);
    }

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

    #[OA\Get(
        path: '/api/commercials/report/detail',
        summary: 'Rapport commercial mensuel détaillé d\'un commercial (académie + agency)',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'commercial_id', in: 'query', description: 'Commercial visé (ignoré pour un commercial : le sien est utilisé)', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Rapport détaillé par activité, ville, semaine et annexe'),
            new OA\Response(response: 403, description: 'Non autorisé'),
            new OA\Response(response: 404, description: 'Profil commercial introuvable'),
        ]
    )]
    public function detail(Request $request): JsonResponse
    {
        $user = $request->user();

        // Un commercial consulte toujours son propre rapport ; les autres rôles
        // habilités (direction, comptable, responsable) choisissent le commercial.
        if ($user->role?->name === 'commercial') {
            $commercial = $user->commercialProfile;
        } else {
            $commercialId = $request->input('commercial_id');
            if (! $commercialId) {
                return response()->json(['message' => 'Le commercial est requis.'], 422);
            }
            $commercial = Commercial::with('agency:id,name')->where('user_id', $commercialId)->first()
                ?? Commercial::with('agency:id,name')->find($commercialId);

            if (! $commercial) {
                $selectedUser = User::with(['role', 'assignments'])->find($commercialId);
                if ($selectedUser && $selectedUser->role?->name !== 'client') {
                    $agency = $selectedUser->assignments->first();
                    $commercial = new Commercial([
                        'user_id' => $selectedUser->id,
                        'agency_id' => $agency?->id,
                        'first_name' => $selectedUser->first_name,
                        'last_name' => $selectedUser->last_name,
                        'email' => $selectedUser->email,
                    ]);
                    $commercial->id = $selectedUser->id;
                    $commercial->setRelation('agency', $agency);
                }
            }
        }

        if (! $commercial) {
            return response()->json(['message' => 'Aucun profil commercial trouvé pour ce compte.'], 404);
        }

        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        if ($from->gt($to)) {
            return response()->json(['message' => 'La date de début doit précéder la date de fin.'], 422);
        }

        return response()->json($this->monthlyService->detail($commercial, $from, $to));
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
