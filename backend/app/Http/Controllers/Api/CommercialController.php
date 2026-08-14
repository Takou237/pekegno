<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AdjustPointsRequest;
use App\Http\Requests\Api\StoreCommercialRequest;
use App\Http\Requests\Api\UpdateCommercialRequest;
use App\Models\Commercial;
use App\Models\CommercialPoint;
use App\Models\Invoice;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class CommercialController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    private function scopeByRole(Builder $query, ?User $user): Builder
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if (in_array($user->role?->name, ['super-admin', 'direction-generale'], true)) {
            return $query;
        }

        if ($user->role?->name === 'responsable-agence') {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->pluck('agency_id');

            return $query->whereIn('agency_id', $agencyIds);
        }

        if ($user->role?->name === 'commercial' && $user->commercialProfile) {
            return $query->whereKey($user->commercialProfile->id);
        }

        return $query->whereRaw('1 = 0');
    }

    #[OA\Get(
        path: '/api/commercials',
        summary: 'Lister les commerciaux',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des commerciaux'),
        ]
    )]
    public function index(Request $request)
    {
        $commercials = Commercial::with('agency', 'user:id,email,first_name,last_name,is_active')
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('agency_id', $agencyId))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->linked === 'true', fn ($q) => $q->whereNotNull('user_id'))
            ->when($request->linked === 'false', fn ($q) => $q->whereNull('user_id'))
            ->when($request->user(), fn ($q) => $this->scopeByRole($q, $request->user()))
            ->orderBy('last_name')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($commercials);
    }

    #[OA\Post(
        path: '/api/commercials',
        summary: 'Créer un commercial',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Commercial créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreCommercialRequest $request): JsonResponse
    {
        $data = $request->validated();

        $commercial = DB::transaction(function () use ($data, $request) {
            $commercial = Commercial::create($data);

            $this->activityLogger->log(
                action: 'created',
                entityType: 'commercial',
                entityId: $commercial->id,
                description: "Commercial {$commercial->full_name} créé",
                newValues: ['email' => $commercial->email],
                request: $request,
            );

            return $commercial;
        });

        return response()->json($commercial->fresh()->load('agency', 'user'), 201);
    }

    #[OA\Get(
        path: '/api/commercials/{commercial}',
        summary: 'Afficher un commercial',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'commercial', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du commercial'),
            new OA\Response(response: 404, description: 'Commercial non trouvé'),
        ]
    )]
    public function show(Request $request, Commercial $commercial): JsonResponse
    {
        $this->scopeByRole(Commercial::whereKey($commercial->id), $request->user())->firstOrFail();

        $commercial->load([
            'agency',
            'user',
            'points' => fn ($q) => $q->orderByDesc('created_at')->limit(50),
            'prospects' => fn ($q) => $q->orderByDesc('created_at'),
        ]);

        return response()->json($commercial);
    }

    #[OA\Put(
        path: '/api/commercials/{commercial}',
        summary: 'Modifier un commercial',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'commercial', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Commercial modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateCommercialRequest $request, Commercial $commercial): JsonResponse
    {
        $this->scopeByRole(Commercial::whereKey($commercial->id), $request->user())->firstOrFail();

        $oldValues = $commercial->only([
            'user_id', 'agency_id', 'first_name', 'last_name', 'email',
            'phone', 'commission_type', 'commission_value', 'is_active',
        ]);

        $commercial->update($request->validated());

        $this->activityLogger->log(
            action: 'updated',
            entityType: 'commercial',
            entityId: $commercial->id,
            description: "Commercial {$commercial->full_name} modifié",
            oldValues: $oldValues,
            newValues: $commercial->only([
                'user_id', 'agency_id', 'first_name', 'last_name', 'email',
                'phone', 'commission_type', 'commission_value', 'is_active',
            ]),
            request: $request,
        );

        return response()->json($commercial->fresh()->load('agency', 'user'));
    }

    #[OA\Delete(
        path: '/api/commercials/{commercial}',
        summary: 'Supprimer un commercial',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'commercial', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Commercial supprimé'),
        ]
    )]
    public function destroy(Request $request, Commercial $commercial): JsonResponse
    {
        $this->scopeByRole(Commercial::whereKey($commercial->id), $request->user())->firstOrFail();

        $name = $commercial->full_name;

        $commercial->delete();

        $this->activityLogger->log(
            action: 'deleted',
            entityType: 'commercial',
            entityId: $commercial->id,
            description: "Commercial {$name} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/commercials/available-users',
        summary: 'Utilisateurs de rôle commercial non encore liés à un profil',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des utilisateurs disponibles'),
        ]
    )]
    public function availableUsers(Request $request): JsonResponse
    {
        $linkedIds = Commercial::pluck('user_id')->filter();

        $users = User::query()
            ->whereHas('role', fn ($q) => $q->where('name', 'commercial'))
            ->when($linkedIds->isNotEmpty(), fn ($q) => $q->whereNotIn('id', $linkedIds))
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'email', 'is_active']);

        return response()->json($users);
    }

    #[OA\Post(
        path: '/api/commercials/{commercial}/points',
        summary: 'Ajuster manuellement les points d\'un commercial',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'commercial', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Points ajustés'),
            new OA\Response(response: 403, description: 'Non autorisé'),
        ]
    )]
    public function adjustPoints(AdjustPointsRequest $request, Commercial $commercial): JsonResponse
    {
        if (! in_array($request->user()?->role?->name, ['super-admin', 'direction-generale'], true)) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        DB::transaction(function () use ($request, $commercial) {
            CommercialPoint::create([
                'commercial_id' => $commercial->id,
                'points' => $request->integer('points'),
                'reason' => 'adjustment',
                'created_by' => $request->user()->id,
            ]);

            $commercial->increment('points_balance', $request->integer('points'));
        });

        $this->activityLogger->log(
            action: 'points_adjusted',
            entityType: 'commercial',
            entityId: $commercial->id,
            description: "Ajustement de {$request->integer('points')} points pour {$commercial->full_name}",
            request: $request,
        );

        return response()->json([
            'message' => 'Points ajustés avec succès.',
            'points_balance' => $commercial->fresh()->points_balance,
        ]);
    }

    #[OA\Get(
        path: '/api/commercials/ranking',
        summary: 'Classement des commerciaux (points, CA, ventes, commissions)',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Classement'),
        ]
    )]
    public function ranking(Request $request): JsonResponse
    {
        $from = $request->date('from');
        $to = $request->date('to');

        $paidFilter = fn ($q) => $q->where('status', 'paid')
            ->whereNull('cancelled_at')
            ->when($from, fn ($q) => $q->whereDate('invoice_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('invoice_date', '<=', $to));

        $commercials = $this->scopeByRole(Commercial::query(), $request->user())
            ->addSelect([
                'sales_count' => Invoice::query()
                    ->selectRaw('count(*)')
                    ->whereColumn('commercial_id', 'commercials.id')
                    ->tap($paidFilter),
                'turnover' => Invoice::query()
                    ->selectRaw('coalesce(sum(total_amount), 0)')
                    ->whereColumn('commercial_id', 'commercials.id')
                    ->tap($paidFilter),
                'commission_total' => Invoice::query()
                    ->selectRaw('coalesce(sum(commission_amount), 0)')
                    ->whereColumn('commercial_id', 'commercials.id')
                    ->tap($paidFilter),
            ])
            ->orderByDesc('points_balance')
            ->orderByDesc('turnover')
            ->orderByDesc('sales_count')
            ->limit(min((int) $request->input('limit', 50), 100))
            ->get(['id', 'first_name', 'last_name', 'email', 'agency_id', 'points_balance', 'is_active']);

        return response()->json($commercials);
    }

    #[OA\Get(
        path: '/api/commercials/{commercial}/stats',
        summary: 'Statistiques d\'un commercial',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'commercial', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Statistiques'),
        ]
    )]
    public function stats(Request $request, Commercial $commercial): JsonResponse
    {
        $this->scopeByRole(Commercial::whereKey($commercial->id), $request->user())->firstOrFail();

        $from = $request->date('from');
        $to = $request->date('to');

        $base = $commercial->invoices()
            ->where('status', 'paid')
            ->whereNull('cancelled_at')
            ->when($from, fn ($q) => $q->whereDate('invoice_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('invoice_date', '<=', $to));

        $dateExpr = \Illuminate\Support\Facades\DB::getDriverName() === 'pgsql'
            ? "to_char(invoice_date, 'YYYY-MM')"
            : "strftime('%Y-%m', invoice_date)";

        $monthly = (clone $base)
            ->select(
                \Illuminate\Support\Facades\DB::raw($dateExpr.' as month'),
                \Illuminate\Support\Facades\DB::raw('sum(total_amount) as total'),
                \Illuminate\Support\Facades\DB::raw('count(*) as count'),
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $servicesSold = \Illuminate\Support\Facades\DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->where('invoices.commercial_id', $commercial->id)
            ->where('invoices.status', 'paid')
            ->whereNull('invoices.cancelled_at')
            ->when($from, fn ($q) => $q->whereDate('invoices.invoice_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('invoices.invoice_date', '<=', $to))
            ->selectRaw('coalesce(label, \'\') as label, sum(quantity) as quantity, sum(line_total) as total')
            ->groupBy('label')
            ->orderByDesc('total')
            ->get();

        return response()->json([
            'commercial' => $commercial->only(['id', 'first_name', 'last_name', 'email', 'points_balance', 'commission_type', 'commission_value', 'is_active']),
            'turnover' => round((float) (clone $base)->sum('total_amount'), 2),
            'sales_count' => (clone $base)->count(),
            'commissions' => round((float) (clone $base)->sum('commission_amount'), 2),
            'points_balance' => $commercial->points_balance,
            'services_sold' => $servicesSold,
            'monthly' => $monthly,
        ]);
    }

    #[OA\Get(
        path: '/api/commercials/search',
        summary: 'Autocomplétion de commerciaux (nom/email)',
        tags: ['Commerciaux'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'q', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Résultats'),
        ]
    )]
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q'));

        $commercials = $this->scopeByRole(Commercial::query(), $request->user())
            ->where(fn ($query) => $query->where('first_name', 'like', "%{$q}%")
                ->orWhere('last_name', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%"))
            ->limit(10)
            ->get(['id', 'first_name', 'last_name', 'email', 'agency_id']);

        return response()->json($commercials);
    }
}
