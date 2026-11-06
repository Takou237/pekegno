<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Country;
use App\Models\Department;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\AcademyReportService;
use App\Services\FinancialKpiService;
use App\Services\RevenueService;
use App\Services\ScopeService;
use App\Support\GroupCurrency;
use App\Support\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class StatsController extends Controller
{
    #[OA\Get(
        path: '/api/stats/overview',
        summary: 'Indicateurs globaux du tableau de bord',
        tags: ['Statistiques'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Indicateurs globaux'),
        ]
    )]
    public function overview(Request $request): JsonResponse
    {
        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        $scope = app(ScopeService::class);
        $agencyIds = $scope->agencyIds($request->user());
        $countryIds = $scope->countryIds($request->user());

        $invoices = Invoice::whereBetween('invoice_date', [$from, $to])
            ->whereNull('cancelled_at')
            ->validated()
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds));

        // Cartes financières : calcul unique (section 1 du cahier), converti dans la monnaie du groupe.
        $kpi = app(FinancialKpiService::class)->summary($from, $to, $agencyIds, true);

        $clientCount = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->when($countryIds !== null, fn ($q) => $q->whereIn('country_id', $countryIds))
            ->count();
        $activeCommercials = Commercial::where('is_active', true)->count();

        $topCommercials = Commercial::query()
            ->with('user:id,first_name,last_name,email')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->withCount([
                'invoices as sales_count' => fn ($q) => $q->whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at')->validated(),
            ])
            ->limit(15)
            ->get()
            ->map(function (Commercial $c) use ($from, $to) {
                // CA du commercial = ses factures validées, quelle que soit l'agence de la facture.
                $revenue = app(FinancialKpiService::class)->summary($from, $to, null, true, $c->id)['revenue'];

                return [
                    'c' => $c,
                    'revenue' => $revenue,
                ];
            })
            ->sortByDesc('revenue')
            ->values()
            ->take(5)
            ->map(fn ($row) => [
                'id' => $row['c']->id,
                'first_name' => $row['c']->first_name,
                'last_name' => $row['c']->last_name,
                'email' => $row['c']->email,
                'points_balance' => $row['c']->points_balance,
                'sales_count' => (int) $row['c']->sales_count,
                'revenue' => (float) ($row['revenue'] ?? 0),
            ]);

        return response()->json([
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            ...$this->kpiPayload($kpi),
            'clients_total' => $clientCount,
            'commercials_active' => $activeCommercials,
            'agencies_total' => Agency::query()
                ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
                ->count(),
            'departments_total' => Department::count(),
            'users_total' => User::count(),
            'top_commercials' => $topCommercials,
        ]);
    }

    #[OA\Get(
        path: '/api/stats/agency/{agency}',
        summary: 'Indicateurs d\'une agence (CA, ventes, top commerciaux)',
        tags: ['Statistiques'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Indicateurs de l\'agence'),
        ]
    )]
    public function agency(Agency $agency, Request $request): JsonResponse
    {
        $scope = app(ScopeService::class);
        $agencyIds = $scope->agencyIds($request->user());

        if ($agencyIds !== null && ! in_array($agency->id, $agencyIds, true)) {
            abort(403, 'Cette agence est hors de votre périmètre.');
        }

        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        $invoices = Invoice::where('agency_id', $agency->id)
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNull('cancelled_at')
            ->validated();

        // Vue d'un département de l'agence : ses factures et dépenses seulement (B23).
        $department = $request->filled('department_id')
            ? Department::where('agency_id', $agency->id)->findOrFail($request->input('department_id'))
            : null;

        $kpi = app(FinancialKpiService::class)->summary($from, $to, [$agency->id], false, null, $department);

        $top = (clone $invoices)
            ->selectRaw('commercial_id, count(*) as sales')
            ->whereNotNull('commercial_id')
            ->groupBy('commercial_id')
            ->limit(15)
            ->get()
            ->map(function ($row) use ($from, $to, $agency) {
                $commercial = Commercial::find($row->commercial_id);
                // Ventes du commercial dans CETTE agence (agence de la facture).
                $turnover = app(FinancialKpiService::class)->summary($from, $to, [$agency->id], false, $row->commercial_id)['revenue'];

                return [
                    'id' => $row->commercial_id,
                    'full_name' => $commercial?->full_name ?? 'Supprimé',
                    'points_balance' => $commercial?->points_balance ?? 0,
                    'turnover' => (float) $turnover,
                    'sales_count' => (int) $row->sales,
                ];
            })
            ->sortByDesc('turnover')
            ->values()
            ->take(5);

        return response()->json([
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
            ],
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            ...$this->kpiPayload($kpi),
            'currency_code' => GroupCurrency::currencyForAgency($agency->id),
            'sales_count' => $kpi['invoices_validated'],
            'top_commercials' => $top,
        ]);
    }

    #[OA\Get(
        path: '/api/stats/monthly-revenue',
        summary: 'Chiffre d\'affaires par mois (12 derniers mois)',
        tags: ['Statistiques'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Filtrer par agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'months', in: 'query', description: 'Nombre de mois', schema: new OA\Schema(type: 'integer', default: 12)),
            new OA\Parameter(name: 'from_enrollments', in: 'query', description: 'Limiter aux factures issues d\'inscriptions academy', schema: new OA\Schema(type: 'boolean')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Série mensuelle'),
        ]
    )]
    public function monthlyRevenue(Request $request): JsonResponse
    {
        $months = (int) $request->integer('months', 12);
        $months = min(max($months, 3), 24);

        $start = Carbon::now()->subMonths($months - 1)->startOfMonth();

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        // Même calcul que les cartes (FinancialKpiService) : CA = factures validées
        // non annulées, par MOIS DE FACTURE ; « collected » = encaissé, par mois de
        // paiement. Monnaie du groupe en vue multi-pays, locale sinon.
        $convert = ! ($request->input('country_id') || $request->input('agency_id'));
        $rate = $convert ? ' * '.GroupCurrency::rateSql('invoices.agency_id') : '';

        $scope = function ($q) use ($request, $agencyIds) {
            return $q->whereNull('invoices.cancelled_at')
                ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
                ->when($request->input('country_id'), fn ($q, $countryId) => $q->whereIn('invoices.agency_id', Agency::idsForCountry($countryId) ?: ['00000000-0000-0000-0000-000000000000']))
                ->when($request->input('agency_id'), fn ($q, $agencyId) => $q->where('invoices.agency_id', $agencyId))
                ->when($request->boolean('from_enrollments'), fn ($q) => $q->whereIn(
                    'invoices.id',
                    FormationEnrollment::query()->whereNotNull('invoice_id')->select('invoice_id')
                ))
                ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds));
        };

        $month = fn (string $col) => DB::getDriverName() === 'pgsql'
            ? "to_char({$col}, 'YYYY-MM')"
            : "strftime('%Y-%m', {$col})";

        $billed = $scope(DB::table('invoices'))
            ->where('invoices.invoice_date', '>=', $start)
            ->selectRaw($month('invoices.invoice_date').' as month, round(sum(invoices.total_amount'.$rate.')) as total, count(*) as count')
            ->groupBy('month')
            ->get()
            ->keyBy('month');

        $collected = $scope(DB::table('invoice_payments')->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id'))
            ->where('invoice_payments.paid_at', '>=', $start)
            ->selectRaw($month('invoice_payments.paid_at').' as month, round(sum(invoice_payments.amount'.$rate.')) as total')
            ->groupBy('month')
            ->pluck('total', 'month');

        $series = collect();

        for ($i = 0; $i < $months; $i++) {
            $current = $start->copy()->addMonths($i);
            $key = $current->format('Y-m');
            $row = $billed->get($key);

            $series->push([
                'month' => $key,
                'label' => $current->format('M Y'),
                'revenue' => (float) ($row->total ?? 0),
                'collected' => (float) ($collected[$key] ?? 0),
                'invoices' => (int) ($row->count ?? 0),
            ]);
        }

        return response()->json($series);
    }

    #[OA\Get(
        path: '/api/stats/top-commercials',
        summary: 'Classement des commerciaux par chiffre d\'affaires',
        tags: ['Statistiques'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Top commerciaux'),
        ]
    )]
    public function topCommercials(Request $request): JsonResponse
    {
        $limit = min(max($request->integer('limit', 5), 1), 50);

        $from = Period::from($request, Carbon::now()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        // CA d'un commercial = ses factures validées de la période (calcul unique,
        // cf. FinancialKpiService), dans les agences du périmètre — l'agence de la
        // FACTURE, pas celle de son profil (vente inter-agences, B16).
        $paidByCommercial = DB::table('invoices')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->whereNotNull('invoices.commercial_id')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->groupBy('invoices.commercial_id')
            ->selectRaw('invoices.commercial_id as commercial_id, round(sum(invoices.total_amount * '.GroupCurrency::rateSql('invoices.agency_id').')) as turnover')
            ->pluck('turnover', 'commercial_id');

        $salesCountByCommercial = Invoice::whereNull('cancelled_at')
            ->validated()
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNotNull('commercial_id')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->groupBy('commercial_id')
            ->selectRaw('commercial_id, count(*) as sales')
            ->pluck('sales', 'commercial_id');

        $commercials = Commercial::with('agency:id,name,code')
            ->whereIn('id', $paidByCommercial->keys()->all() ?: ['00000000-0000-0000-0000-000000000000'])
            ->limit($limit * 3)
            ->get()
            ->map(fn (Commercial $c) => [
                'id' => $c->id,
                'full_name' => $c->full_name,
                'agency' => $c->agency?->name,
                'points_balance' => $c->points_balance,
                'turnover' => (float) ($paidByCommercial[$c->id] ?? 0),
                'sales_count' => (int) ($salesCountByCommercial[$c->id] ?? 0),
            ])
            ->sortByDesc('turnover')
            ->values()
            ->take($limit);

        return response()->json($commercials);
    }

    #[OA\Get(
        path: '/api/stats/sales-by-category',
        summary: 'Ventes par catégorie (CA et nombre de lignes)',
        tags: ['Statistiques'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Répartition par catégorie'),
        ]
    )]
    public function salesByCategory(Request $request): JsonResponse
    {
        $from = Period::from($request, Carbon::now()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        $rows = InvoiceItem::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            // LEFT JOIN : les lignes issues de packages / prestations / produits
            // n'ont pas toujours de service_id, et un service n'a pas toujours
            // de catégorie. En INNER JOIN elles disparaissaient et le tableau
            // « Ventes par catégorie » affichait « Aucune donnée » à tort.
            ->leftJoin('services', 'services.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories', 'categories.id', '=', 'services.category_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw("coalesce(categories.name, 'Sans catégorie') as name, sum(invoice_items.line_total * ".GroupCurrency::rateSql('invoices.agency_id').') as total, count(*) as items')
            ->groupByRaw("coalesce(categories.name, 'Sans catégorie')")
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->name,
                'revenue' => (float) $row->total,
                'items' => (int) $row->items,
            ]);

        return response()->json($rows);
    }

    #[OA\Get(
        path: '/api/stats/payment-methods',
        summary: 'Répartition des encaissements par mode de paiement',
        tags: ['Statistiques'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Cash vs Mobile'),
        ]
    )]
    public function paymentMethods(Request $request): JsonResponse
    {
        $from = Period::from($request, Carbon::now()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        $result = app(RevenueService::class)->byMode($from, $to, ['agency_ids' => $agencyIds], true);

        $rows = collect(RevenueService::MODES)
            ->map(fn ($mode) => [
                'method' => $mode,
                'total' => $result['buckets'][$mode] ?? 0.0,
                'count' => $result['counts'][$mode] ?? 0,
            ])
            ->filter(fn ($row) => $row['total'] > 0 || $row['count'] > 0)
            ->values();

        return response()->json($rows);
    }

    /**
     * Top produits/services : meilleures ventes par quantité, CA et nombre de transactions.
     */
    public function topProducts(Request $request): JsonResponse
    {
        $limit = min(max($request->integer('limit', 5), 1), 50);
        $from = Period::from($request, Carbon::now()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        $rows = InvoiceItem::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->leftJoin('services', 'services.id', '=', 'invoice_items.service_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw('coalesce(invoice_items.label, services.name) as label, sum(invoice_items.quantity) as quantity, sum(invoice_items.line_total * '.GroupCurrency::rateSql('invoices.agency_id').') as revenue, count(*) as transactions')
            ->groupByRaw('coalesce(invoice_items.label, services.name)')
            ->orderByRaw('sum(invoice_items.quantity) desc')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'label' => $row->label ?: '—',
                'quantity' => (int) $row->quantity,
                'revenue' => (float) $row->revenue,
                'transactions' => (int) $row->transactions,
            ]);

        return response()->json($rows);
    }

    /**
     * Top agences : classement par chiffre d'affaires réalisé.
     */
    public function topAgencies(Request $request): JsonResponse
    {
        $limit = min(max($request->integer('limit', 5), 1), 50);
        $from = Period::from($request, Carbon::now()->startOfYear());
        $to = Period::to($request);

        $agencyIds = app(ScopeService::class)->agencyIds($request->user());

        // CA par agence = factures validées de la période (calcul unique), converti.
        $byAgency = Invoice::whereNull('cancelled_at')
            ->validated()
            ->whereBetween('invoice_date', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->groupBy('agency_id')
            ->selectRaw('agency_id, round(sum(total_amount * '.GroupCurrency::rateSql('invoices.agency_id').')) as revenue')
            ->pluck('revenue', 'agency_id');

        $counts = Invoice::whereNull('cancelled_at')
            ->validated()
            ->whereBetween('invoice_date', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->groupBy('agency_id')
            ->selectRaw('agency_id, count(*) as invoices_count')
            ->pluck('invoices_count', 'agency_id');

        $rows = Agency::query()
            ->whereNull('deleted_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->get()
            ->map(fn (Agency $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'code' => $a->code,
                'country' => $a->country,
                'country_id' => $a->country_id,
                'revenue' => (float) ($byAgency[$a->id] ?? 0),
                'invoices_count' => (int) ($counts[$a->id] ?? 0),
            ])
            ->sortByDesc('revenue')
            ->values()
            ->take($limit);

        return response()->json($rows);
    }

    /**
     * Group-level stats: global KPIs + per-country breakdown.
     */
    public function group(Request $request): JsonResponse
    {
        $from = Period::from($request, Carbon::now()->startOfYear());
        $to = Period::to($request);

        $scope = app(ScopeService::class);
        $agencyIds = $scope->agencyIds($request->user());

        // Global aggregates
        $invoices = Invoice::whereBetween('invoice_date', [$from, $to])
            ->whereNull('cancelled_at')
            ->validated()
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds));

        // Cartes financières du groupe : calcul unique, converti dans la monnaie du groupe.
        $kpi = app(FinancialKpiService::class)->summary($from, $to, $agencyIds, true);

        $clientCount = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->when($agencyIds !== null, function ($q) use ($agencyIds) {
                $countryIds = Agency::whereIn('id', $agencyIds)->whereNotNull('country_id')->pluck('country_id')->unique();
                $q->whereIn('country_id', $countryIds);
            })
            ->count();

        $newClients = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->whereBetween('created_at', [$from, $to])
            ->when($agencyIds !== null, function ($q) use ($agencyIds) {
                $countryIds = Agency::whereIn('id', $agencyIds)->whereNotNull('country_id')->pluck('country_id')->unique();
                $q->whereIn('country_id', $countryIds);
            })
            ->count();

        $activeSubscriptions = Subscription::query()
            ->where('status', 'active')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->count();

        // Per-country breakdown — join invoices via agencies.country_id
        // (avec repli libellé legacy pour les pays sans FK, ex. Côte d'Ivoire).
        $countries = Country::withCount('agencies')
            ->get()
            ->map(function (Country $country) use ($from, $to) {
                $countryAgencyIds = collect(Agency::idsForCountry($country->id));

                // Monnaie locale du pays : calcul unique des cartes.
                $countryKpi = app(FinancialKpiService::class)->summary($from, $to, $countryAgencyIds->values()->all());

                return [
                    'id' => $country->id,
                    'name' => $country->name,
                    'code' => $country->code,
                    'currency_code' => $country->currency_code,
                    'exchange_rate' => (float) ($country->exchange_rate ?? 1),
                    'invoice_settings' => $country->invoice_settings,
                    'iso_code' => $country->iso_code,
                    'phone_code' => $country->phone_code,
                    'is_active' => $country->is_active,
                    'agencies_count' => $country->agencies_count,
                    'revenue' => $countryKpi['revenue'],
                    'payments_total' => $countryKpi['collected'],
                    'outstanding' => $countryKpi['outstanding'],
                    'invoices_count' => $countryKpi['invoices_validated'],
                    'expenses_total' => $countryKpi['expenses'],
                    'has_agencies' => ! $countryAgencyIds->isEmpty(),
                ];
            });

        return response()->json([
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'currency_code' => GroupCurrency::code(),
            ...$this->kpiPayload($kpi),
            'clients_total' => $clientCount,
            'new_clients' => $newClients,
            'subscriptions_active' => $activeSubscriptions,
            // Panier moyen : CA ÷ nombre de factures validées (B17).
            'average_invoice_value' => $kpi['average_basket'],
            'agencies_total' => Agency::query()
                ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
                ->count(),
            'departments_total' => Department::count(),
            'users_total' => User::count(),
            'countries' => $countries,
        ]);
    }

    /**
     * Country-level stats: KPIs scoped to a specific country.
     */
    public function country(Country $country, Request $request): JsonResponse
    {
        $scope = app(ScopeService::class);
        $agencyIds = $scope->agencyIds($request->user());

        // Verify access to this country
        $countryAgencyIds = Agency::idsForCountry($country->id);
        if ($agencyIds !== null) {
            $allowed = array_intersect($agencyIds, $countryAgencyIds);
            if (empty($allowed)) {
                abort(403, 'Accès refusé pour ce pays.');
            }
            $countryAgencyIds = array_values($allowed);
        }

        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        $invoices = Invoice::whereIn('agency_id', $countryAgencyIds)
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNull('cancelled_at')
            ->validated();

        // Cartes financières du pays (monnaie locale) : calcul unique.
        $kpi = app(FinancialKpiService::class)->summary($from, $to, array_values($countryAgencyIds));

        $clientCount = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->where('country_id', $country->id)
            ->count();

        $agencyCount = count(Agency::idsForCountry($country->id));
        $departmentCount = Department::whereIn('agency_id', $countryAgencyIds)->count();
        $userCount = User::query()
            ->where(function ($q) use ($countryAgencyIds) {
                $q->whereIn('registered_agency_id', $countryAgencyIds)
                    ->orWhereHas('assignments', fn ($inner) => $inner->whereIn('agency_id', $countryAgencyIds));
            })
            ->count();

        $topCommercials = Commercial::query()
            ->whereIn('agency_id', $countryAgencyIds)
            ->with('user:id,first_name,last_name,email')
            ->withCount([
                'invoices as sales_count' => fn ($q) => $q->whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at')->validated(),
            ])
            ->limit(15)
            ->get()
            ->map(fn (Commercial $c) => [
                'c' => $c,
                // Ventes du commercial dans les agences du pays (agence de la facture).
                'revenue' => app(FinancialKpiService::class)->summary($from, $to, array_values($countryAgencyIds), false, $c->id)['revenue'],
            ])
            ->sortByDesc('revenue')
            ->values()
            ->take(5)
            ->map(fn ($row) => [
                'id' => $row['c']->id,
                'first_name' => $row['c']->first_name,
                'last_name' => $row['c']->last_name,
                'email' => $row['c']->email,
                'points_balance' => $row['c']->points_balance,
                'sales_count' => (int) $row['c']->sales_count,
                'revenue' => (float) ($row['revenue'] ?? 0),
            ]);

        return response()->json([
            'country' => [
                'id' => $country->id,
                'name' => $country->name,
                'code' => $country->code,
                'currency_code' => $country->currency_code,
            ],
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            ...$this->kpiPayload($kpi),
            'clients_total' => $clientCount,
            'agencies_total' => $agencyCount,
            'departments_total' => $departmentCount,
            'users_total' => $userCount,
            'top_commercials' => $topCommercials,
            'has_agencies' => ! empty($countryAgencyIds),
        ]);
    }

    /**
     * Statistiques académie agrégées au niveau du groupe (toutes agences autorisées).
     */
    public function trainingGroup(Request $request): JsonResponse
    {
        $scopeService = app(ScopeService::class);
        $agencyIds = $scopeService->agencyIds($request->user());

        if ($request->filled('agency_id')) {
            $agencyId = $request->input('agency_id');
            $agencyIds = $agencyIds === null
                ? [$agencyId]
                : array_values(array_intersect($agencyIds, [$agencyId]));
        } elseif ($request->filled('country_id')) {
            $countryAgencyIds = Agency::idsForCountry($request->input('country_id'));
            $agencyIds = $agencyIds === null
                ? ($countryAgencyIds ?: null)
                : array_values(array_intersect($agencyIds, $countryAgencyIds));
        }

        $service = app(AcademyReportService::class);

        // Dépenses du périmètre (pour le dashboard academy) : même source
        // comptable que le groupe, filtrée aux agences autorisées.
        $expenses = AccountingTransaction::where('type', 'expense')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->sum('amount');

        return response()->json([
            'training' => $service->groupStats($agencyIds),
            'expenses_total' => (float) $expenses,
            'services' => $service->groupServices($agencyIds),
        ]);
    }

    /**
     * Cartes financières (FinancialKpiService) au format des réponses de stats.
     * Les anciennes clés sont conservées (revenue, payments_total…) avec le
     * calcul du cahier : `revenue` = CA facturé validé, `payments_total` = encaissé.
     *
     * @param  array<string, float|int|bool>  $kpi
     * @return array<string, float|int|bool>
     */
    private function kpiPayload(array $kpi): array
    {
        return [
            'revenue' => $kpi['revenue'],
            'payments_total' => $kpi['collected'],
            'recoveries_total' => $kpi['recoveries'],
            'advances_total' => $kpi['advances'],
            'outstanding' => $kpi['outstanding'],
            'expenses_total' => $kpi['expenses'],
            'pending_validation_total' => $kpi['pending_validation'],
            'pending_validation_count' => $kpi['pending_validation_count'],
            'net_cash' => $kpi['net_cash'],
            'invoices_total' => $kpi['invoices_validated'],
            'invoices_paid' => $kpi['invoices_paid'],
            'average_basket' => $kpi['average_basket'],
            'collection_rate' => $kpi['collection_rate'],
            'collected_on_period_invoices' => $kpi['collected_on_period_invoices'],
            'control_ok' => $kpi['control_ok'],
        ];
    }
}
