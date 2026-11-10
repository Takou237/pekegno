<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ScopeService;
use App\Support\Period;
use App\Support\PlaceName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class ReportController extends Controller
{
    #[OA\Get(
        path: '/api/reports/subscriptions',
        summary: 'Rapport abonnements',
        tags: ['Rapports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Synthèse et tendances des abonnements'),
        ]
    )]
    public function subscriptions(Request $request): JsonResponse
    {
        $from = Period::from($request, Period::businessToday()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        $base = Subscription::query()
            ->where('subscriptions.start_date', '>=', $from)
            ->where('subscriptions.start_date', '<=', $to)
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('subscriptions.agency_id', $agencyId))
            ->when($request->country_id, fn ($q, $countryId) => $q->whereHas('agency', fn ($inner) => $inner->where('country_id', $countryId)))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('subscriptions.agency_id', $agencyIds));

        $today = today();

        $rows = (clone $base)
            ->selectRaw('subscriptions.status, count(*) as total, sum(subscriptions.price_per_month) as mrr')
            ->groupBy('subscriptions.status')
            ->get()
            ->keyBy('status');

        $live = (clone $base)->whereIn('subscriptions.status', ['active', 'pending', 'suspended']);
        $expiredFromStatus = (clone $live)->where('subscriptions.end_date', '<', $today);

        $expiredCount = (int) $expiredFromStatus->count();
        $expiredMrr = (float) $expiredFromStatus->sum('subscriptions.price_per_month');

        $byStatus = collect(Subscription::LIFECYCLE_STATUSES)->mapWithKeys(function ($status) use ($rows, $expiredCount) {
            $total = (int) ($rows->get($status)->total ?? 0);
            $mrr = (float) ($rows->get($status)->mrr ?? 0);
            if ($status === 'expired') {
                $total += $expiredCount;
            }

            return [$status => ['count' => $total, 'mrr' => $mrr]];
        });

        $packs = (clone $base)
            ->join('subscription_packs', 'subscription_packs.id', '=', 'subscriptions.subscription_pack_id')
            ->selectRaw('subscription_packs.name, count(*) as total, sum(subscriptions.months * subscriptions.price_per_month) as revenue')
            ->groupBy('subscription_packs.name')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row) => [
                'pack' => $row->name,
                'count' => (int) $row->total,
                'revenue' => (float) $row->revenue,
            ]);

        $dateExpr = DB::getDriverName() === 'pgsql'
            ? "to_char(start_date, 'YYYY-MM')"
            : "strftime('%Y-%m', subscriptions.start_date)";

        $trend = (clone $base)
            ->select(DB::raw($dateExpr.' as month'), DB::raw('count(*) as total'))
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'new_subscriptions' => (int) $row->total,
            ]);

        // B21 : la carte « Actifs » compte les contrats ouverts, pas les
        // anciennes subscriptions (legacy).
        $activeContracts = Contract::query()
            ->open()
            ->whereBetween('contracts.start_date', [$from, $to])
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('contracts.agency_id', $agencyId))
            ->when($request->country_id, fn ($q, $countryId) => $q->whereHas('agency', fn ($inner) => $inner->where('country_id', $countryId)))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('contracts.agency_id', $agencyIds))
            ->count();

        return response()->json([
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'totals' => [
                'subscriptions' => (int) $base->count(),
                'active' => (int) (clone $base)->where('subscriptions.status', 'active')->count(),
                'active_contracts' => $activeContracts,
                'renewed' => (int) (clone $base)->where('subscriptions.status', 'renewed')->count(),
                'cancelled' => (int) (clone $base)->where('subscriptions.status', 'cancelled')->count(),
                'expired' => $expiredCount + (int) (clone $base)->where('subscriptions.status', 'expired')->count(),
                'expiring_soon' => (int) (clone $live)->where('subscriptions.end_date', '>=', $today)->whereDate('subscriptions.end_date', '<=', $today->copy()->addDays(30))->count(),
                'mr_maintenu' => (float) (clone $live)->where('subscriptions.end_date', '>=', $today)->sum('subscriptions.price_per_month'),
            ],
            'by_status' => $byStatus,
            'by_pack' => $packs,
            'trend' => $trend,
        ]);
    }

    #[OA\Get(
        path: '/api/reports/customers',
        summary: 'Rapport clients',
        tags: ['Rapports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'limit', in: 'query', description: 'Nombre de clients du top', schema: new OA\Schema(type: 'integer', default: 10)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Synthèse et top clients'),
        ]
    )]
    public function customers(Request $request): JsonResponse
    {
        $from = Period::from($request, Period::businessToday()->startOfYear());
        $to = Period::to($request);
        $limit = min(max($request->integer('limit', 10), 1), 50);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        $clients = User::whereHas('role', fn ($q) => $q->where('name', 'client'));

        // Filtre pays / ville (texte libre des fiches, graphies regroupées) :
        // tout le rapport se limite aux clients de ce lieu.
        $country = PlaceName::countryResolver();
        $allPlaces = (clone $clients)
            ->leftJoin('countries', 'countries.id', '=', 'users.country_id')
            ->leftJoin('cities', 'cities.id', '=', 'users.city_id')
            ->get(['users.id', 'countries.name as country_ref', 'users.country as country_text', 'cities.name as city_ref', 'users.city as city_text'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'country' => $p->country_ref ?? $country($p->country_text),
                'city' => $p->city_ref ?? $p->city_text,
            ]);

        $wantedCountry = $request->filled('country') ? PlaceName::key($country($request->input('country'))) : null;
        $wantedCity = $request->filled('city') ? PlaceName::key($request->input('city')) : null;
        $placeIds = null;
        if ($wantedCountry !== null || $wantedCity !== null) {
            $placeIds = $allPlaces
                ->filter(fn ($p) => ($wantedCountry === null || PlaceName::key($p['country']) === $wantedCountry)
                    && ($wantedCity === null || PlaceName::key($p['city']) === $wantedCity))
                ->pluck('id')
                ->all();
            $clients->whereIn('users.id', $placeIds);
        }

        // Clients du périmètre : agence d'inscription (les clients n'ont pas
        // d'affectation d'agence ; l'ancien filtre les excluait tous).
        $newClients = (clone $clients)
            ->whereBetween('users.created_at', [$from, $to])
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('users.registered_agency_id', $agencyId))
            ->when($request->country_id, fn ($q, $countryId) => $q->where(fn ($q) => $q
                ->where('users.country_id', $countryId)
                ->orWhereIn('users.registered_agency_id', Agency::where('country_id', $countryId)->select('id'))))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('users.registered_agency_id', $agencyIds));

        // B27 : pays et ville sont saisis en texte libre (country_id / city_id
        // jamais remplis) ; les variantes sont regroupées (Cameroun / Cameroon…).
        $places = (clone $newClients)
            ->leftJoin('countries', 'countries.id', '=', 'users.country_id')
            ->leftJoin('cities', 'cities.id', '=', 'users.city_id')
            ->get(['countries.name as country_ref', 'users.country as country_text', 'cities.name as city_ref', 'users.city as city_text']);

        $unknown = 'Non renseigné';

        $byCountry = PlaceName::rank($places->map(fn ($p) => $p->country_ref ?? $country($p->country_text)), $unknown)
            ->map(fn ($row) => ['country' => $row['name'], 'count' => $row['count']]);

        $byCity = PlaceName::rank($places->map(fn ($p) => $p->city_ref ?? $p->city_text), $unknown)
            ->map(fn ($row) => ['city' => $row['name'], 'count' => $row['count']]);

        // CA = factures validées non annulées de la période, payées ou non
        // (calcul unique, cf. FinancialMetricsService) — plus seulement les factures soldées.
        $invoices = Invoice::whereNull('invoices.cancelled_at')
            ->validated()
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('invoices.agency_id', $agencyId))
            ->when($request->country_id, fn ($q, $countryId) => $q->whereHas('agency', fn ($inner) => $inner->where('country_id', $countryId)))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->when($placeIds !== null, fn ($q) => $q->whereIn('invoices.client_id', $placeIds));

        $topClients = (clone $invoices)
            ->join('users', 'users.id', '=', 'invoices.client_id')
            ->selectRaw('invoices.client_id, users.first_name, users.last_name, sum(invoices.total_amount) as turnover, count(*) as orders')
            ->groupBy('invoices.client_id', 'users.first_name', 'users.last_name')
            ->orderByDesc('turnover')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'client_id' => $row->client_id,
                'client' => trim($row->first_name.' '.$row->last_name) ?: 'Client',
                'turnover' => (float) $row->turnover,
                'orders' => (int) $row->orders,
            ]);

        $byCommercial = (clone $invoices)
            ->whereNotNull('commercial_id')
            ->join('commercials', 'commercials.id', '=', 'invoices.commercial_id')
            ->selectRaw('commercials.id, commercials.first_name, commercials.last_name, sum(invoices.total_amount) as turnover, count(*) as orders')
            ->groupBy('commercials.id', 'commercials.first_name', 'commercials.last_name')
            ->orderByDesc('turnover')
            ->get()
            ->map(fn ($row) => [
                'commercial_id' => $row->id,
                'commercial' => trim($row->first_name.' '.$row->last_name),
                'turnover' => (float) $row->turnover,
                'orders' => (int) $row->orders,
            ]);

        $activeCustomers = (clone $clients)
            ->whereHas('clientInvoices', fn ($q) => $q->whereNull('cancelled_at')
                ->whereBetween('invoice_date', [$from, $to])
                ->when($request->agency_id, fn ($inner, $agencyId) => $inner->where('agency_id', $agencyId))
                ->when($request->country_id, fn ($inner, $countryId) => $inner->whereHas('agency', fn ($a) => $a->where('country_id', $countryId)))
                ->when($agencyIds !== null, fn ($inner) => $inner->whereIn('agency_id', $agencyIds)))
            ->count();

        return response()->json([
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'totals' => [
                'clients_total' => (int) $clients->count(),
                'clients_new' => (int) $newClients->count(),
                'clients_active' => $activeCustomers,
                'turnover' => (float) (clone $invoices)->sum('total_amount'),
            ],
            'by_country' => $byCountry,
            'by_city' => $byCity,
            'top_clients' => $topClients,
            'by_commercial' => $byCommercial,
            // Choix des filtres : tous les pays et villes des fiches clients
            // (avant filtre), pour que la liste ne rétrécisse pas.
            'place_options' => [
                'countries' => PlaceName::rank($allPlaces->pluck('country'), '')->pluck('name')->filter()->values(),
                'cities' => PlaceName::rank($allPlaces->pluck('city'), '')->pluck('name')->filter()->values(),
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/reports/comparison',
        summary: 'Comparaison du chiffre d\'affaires par pays, ville ou agence',
        tags: ['Rapports'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'dimension', in: 'query', required: true, description: 'country, city ou agency', schema: new OA\Schema(type: 'string', enum: ['country', 'city', 'agency'])),
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'CA groupé par dimension'),
        ]
    )]
    public function comparison(Request $request): JsonResponse
    {
        $dimension = $request->string('dimension', 'agency')->lower()->toString();
        abort_unless(in_array($dimension, ['country', 'city', 'agency'], true), 422, 'Dimension invalide.');

        $from = Period::from($request, Period::businessToday()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        // CA = factures validées non annulées de la période, payées ou non
        // (calcul unique, cf. FinancialMetricsService) — plus seulement les factures soldées.
        $query = Invoice::whereNull('cancelled_at')
            ->validated()
            ->whereBetween('invoice_date', [$from, $to])
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('agency_id', $agencyId))
            ->when($request->country_id, fn ($q, $countryId) => $q->whereHas('agency', fn ($inner) => $inner->where('country_id', $countryId)))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds));

        $select = match ($dimension) {
            'country' => [
                DB::raw('agencies.country_id as id'),
                DB::raw('countries.name as label'),
            ],
            'city' => [
                DB::raw('agencies.city_id as id'),
                DB::raw('cities.name as label'),
            ],
            default => [
                DB::raw('agencies.id as id'),
                DB::raw('agencies.name as label'),
            ],
        };

        $groupBy = match ($dimension) {
            'country' => ['agencies.country_id', 'countries.name'],
            'city' => ['agencies.city_id', 'cities.name'],
            default => ['agencies.id', 'agencies.name'],
        };

        $rows = (clone $query)
            ->join('agencies', 'agencies.id', '=', 'invoices.agency_id')
            ->when($dimension === 'country', fn ($q) => $q->join('countries', 'countries.id', '=', 'agencies.country_id'))
            ->when($dimension === 'city', fn ($q) => $q->join('cities', 'cities.id', '=', 'agencies.city_id'))
            ->select([...$select, DB::raw('round(sum(invoices.total_amount * '.\App\Support\GroupCurrency::rateSql('invoices.agency_id').')) as revenue'), DB::raw('count(*) as invoices')])
            ->groupBy($groupBy)
            ->orderByDesc('revenue')
            ->get();

        $total = (float) $rows->sum('revenue');

        $data = $rows->map(fn ($row) => [
            'id' => $row->id,
            'label' => $row->label,
            'revenue' => (float) $row->revenue,
            'invoices' => (int) $row->invoices,
            'share' => $total > 0 ? round(((float) $row->revenue / $total) * 100, 2) : 0,
        ]);

        return response()->json([
            'dimension' => $dimension,
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'total_revenue' => $total,
            'data' => $data,
        ]);
    }
}
