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

        // Montants multi-pays : convertis dans la monnaie du groupe.
        $rateSql = GroupCurrency::rateSql('invoices.agency_id');
        $rates = GroupCurrency::agencyRates();

        $revenue = (clone $invoices)->where('status', 'paid')->sum(DB::raw('total_amount * '.$rateSql));
        $outstanding = (clone $invoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['agency_id', 'total_amount', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due * ($rates[$i->agency_id] ?? 1));
        $invoiceCount = (clone $invoices)->count();
        $paidCount = (clone $invoices)->where('status', 'paid')->count();

        $payments = InvoicePayment::whereBetween('paid_at', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereHas('invoice', fn ($inner) => $inner->validated()->whereIn('agency_id', $agencyIds)))
            ->sum(DB::raw('amount * '.GroupCurrency::rateSql('(select invoices.agency_id from invoices where invoices.id = invoice_payments.invoice_id)')));
        $advances = InvoicePayment::whereBetween('paid_at', [$from, $to])
            ->where('is_advance', true)
            ->whereHas('invoice', fn ($q) => $q->whereNull('cancelled_at')->validated()->whereIn('status', ['unpaid', 'partial'])->when($agencyIds !== null, fn ($inner) => $inner->whereIn('agency_id', $agencyIds)))
            ->sum(DB::raw('amount * '.GroupCurrency::rateSql('(select invoices.agency_id from invoices where invoices.id = invoice_payments.invoice_id)')));

        $clientCount = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->when($countryIds !== null, fn ($q) => $q->whereIn('country_id', $countryIds))
            ->count();
        $activeCommercials = Commercial::where('is_active', true)->count();

        $topCommercials = Commercial::query()
            ->with('user:id,first_name,last_name,email')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->withSum([
                'invoices as revenue' => fn ($q) => $q->whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at')->validated()->where('status', 'paid'),
            ], DB::raw('total_amount * '.GroupCurrency::rateSql('invoices.agency_id')))
            ->withCount([
                'invoices as sales_count' => fn ($q) => $q->whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at')->validated(),
            ])
            ->limit(5)
            ->get()
            ->sortByDesc('revenue')
            ->values()
            ->map(fn (Commercial $c) => [
                'id' => $c->id,
                'first_name' => $c->first_name,
                'last_name' => $c->last_name,
                'email' => $c->email,
                'points_balance' => $c->points_balance,
                'sales_count' => (int) $c->sales_count,
                'revenue' => (float) ($c->revenue ?? 0),
            ]);

        return response()->json([
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'revenue' => (float) $revenue,
            'payments_total' => (float) $payments,
            'advances_total' => (float) $advances,
            'outstanding' => (float) $outstanding,
            'invoices_total' => $invoiceCount,
            'invoices_paid' => $paidCount,
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

        $revenue = (clone $invoices)->where('status', 'paid')->sum('total_amount');
        $salesCount = (clone $invoices)->count();
        $outstanding = (clone $invoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['total_amount', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due);

        $top = (clone $invoices)
            ->selectRaw('commercial_id, sum(total_amount) as turnover, count(*) as sales')
            ->whereNotNull('commercial_id')
            ->groupBy('commercial_id')
            ->orderByDesc('turnover')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                $commercial = Commercial::find($row->commercial_id);

                return [
                    'id' => $row->commercial_id,
                    'full_name' => $commercial?->full_name ?? 'Supprimé',
                    'points_balance' => $commercial?->points_balance ?? 0,
                    'turnover' => (float) $row->turnover,
                    'sales_count' => (int) $row->sales,
                ];
            });

        return response()->json([
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
            ],
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'revenue' => (float) $revenue,
            'outstanding' => (float) $outstanding,
            'sales_count' => $salesCount,
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

        $query = Invoice::whereNull('cancelled_at')
            ->where('invoice_date', '>=', $start)
            ->where('status', 'paid')
            ->validated()
            ->when($request->country_id, fn ($q, $countryId) => $q->whereHas('agency', fn ($inner) => $inner->where('country_id', $countryId)))
            ->when($request->agency_id, fn ($q, $agencyId) => $q->where('agency_id', $agencyId))
            ->when($request->boolean('from_enrollments'), fn ($q) => $q->whereIn(
                'invoices.id',
                FormationEnrollment::query()->whereNotNull('invoice_id')->pluck('invoice_id')
            ))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds));

        // Vue multi-pays (sans filtre pays/agence) : montants convertis dans la
        // monnaie du groupe ; sinon on reste dans la monnaie locale.
        $amountExpr = ($request->country_id || $request->agency_id)
            ? 'total_amount'
            : 'total_amount * '.GroupCurrency::rateSql('invoices.agency_id');

        $dateExpr = DB::getDriverName() === 'pgsql'
            ? "to_char(invoice_date, 'YYYY-MM')"
            : "strftime('%Y-%m', invoice_date)";

        $rows = (clone $query)
            ->select(
                DB::raw($dateExpr.' as month'),
                DB::raw('sum('.$amountExpr.') as total'),
                DB::raw('count(*) as count'),
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $series = collect();

        for ($i = 0; $i < $months; $i++) {
            $month = $start->copy()->addMonths($i);
            $key = $month->format('Y-m');
            $row = $rows->get($key);

            $series->push([
                'month' => $month->format('Y-m'),
                'label' => $month->format('M Y'),
                'revenue' => (float) ($row->total ?? 0),
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

        // CA = total des factures validées sur la période (tous statuts :
        // payées, partielles, impayées), pas uniquement les payées : sinon le
        // « Meilleur commercial » n'affiche qu'1 vente sur 13 dans la période.
        $commercials = Commercial::with('agency:id,name,code')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->whereHas('invoices', fn ($q) => $q->whereNull('cancelled_at')->validated()->whereBetween('invoice_date', [$from, $to]))
            ->withSum(['invoices as turnover' => fn ($q) => $q->whereNull('cancelled_at')->validated()->whereBetween('invoice_date', [$from, $to])], DB::raw('total_amount * '.GroupCurrency::rateSql('invoices.agency_id')))
            ->withCount(['invoices as sales_count' => fn ($q) => $q->whereNull('cancelled_at')->validated()->whereBetween('invoice_date', [$from, $to])])
            ->orderByDesc('turnover')
            ->limit($limit)
            ->get()
            ->map(fn (Commercial $c) => [
                'id' => $c->id,
                'full_name' => $c->full_name,
                'agency' => $c->agency?->name,
                'points_balance' => $c->points_balance,
                'turnover' => (float) ($c->turnover ?? 0),
                'sales_count' => (int) $c->sales_count,
            ]);

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

        $rows = InvoicePayment::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereBetween('invoice_payments.paid_at', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->where('invoices.validation_status', 'validated')
            ->selectRaw('invoice_payments.payment_method, sum(invoice_payments.amount * '.GroupCurrency::rateSql('invoices.agency_id').') as total, count(*) as count')
            ->groupBy('invoice_payments.payment_method')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'total' => (float) $row->total,
                'count' => (int) $row->count,
            ]);

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

        $rows = Agency::query()
            ->whereNull('deleted_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->withSum([
                // CA = total des factures validées sur la période (tous statuts),
                // cohérent avec Top produits et Meilleur commercial.
                'invoices as revenue' => fn ($q) => $q->whereNull('cancelled_at')
                    ->validated()
                    ->whereBetween('invoice_date', [$from, $to]),
            ], DB::raw('total_amount * '.GroupCurrency::rateSql('invoices.agency_id')))
            ->withCount([
                'invoices as invoices_count' => fn ($q) => $q->whereNull('cancelled_at')
                    ->validated()
                    ->whereBetween('invoice_date', [$from, $to]),
            ])
            ->get()
            ->sortByDesc('revenue')
            ->values()
            ->take($limit)
            ->map(fn (Agency $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'code' => $a->code,
                'country' => $a->country,
                'country_id' => $a->country_id,
                'revenue' => (float) $a->revenue,
                'invoices_count' => (int) $a->invoices_count,
            ]);

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

        // Montants multi-pays : convertis dans la monnaie du groupe.
        $rateSql = GroupCurrency::rateSql('invoices.agency_id');
        $rates = GroupCurrency::agencyRates();

        $revenue = (clone $invoices)->where('status', 'paid')->sum(DB::raw('total_amount * '.$rateSql));
        $outstanding = (clone $invoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['agency_id', 'total_amount', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due * ($rates[$i->agency_id] ?? 1));
        $invoiceCount = (clone $invoices)->count();
        $paidCount = (clone $invoices)->where('status', 'paid')->count();

        $payments = InvoicePayment::whereBetween('paid_at', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereHas('invoice', fn ($inner) => $inner->validated()->whereIn('agency_id', $agencyIds)))
            ->sum(DB::raw('amount * '.GroupCurrency::rateSql('(select invoices.agency_id from invoices where invoices.id = invoice_payments.invoice_id)')));

        $expenses = AccountingTransaction::where('type', 'expense')
            ->whereBetween('transacted_at', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->sum(DB::raw('amount * '.GroupCurrency::rateSql('accounting_transactions.agency_id')));

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
        $countries = Country::withCount('agencies')
            ->get()
            ->map(function (Country $country) use ($from, $to) {
                $countryAgencyIds = Agency::where('country_id', $country->id)->pluck('id');

                $countryInvoiceQuery = Invoice::whereIn('agency_id', $countryAgencyIds)
                    ->whereBetween('invoice_date', [$from, $to])
                    ->whereNull('cancelled_at')
                    ->validated();

                $countryRevenue = (clone $countryInvoiceQuery)->where('status', 'paid')->sum('total_amount');
                $countryOutstanding = (clone $countryInvoiceQuery)
                    ->whereIn('status', ['unpaid', 'partial'])
                    ->get(['total_amount', 'amount_paid'])
                    ->sum(fn (Invoice $i) => $i->balance_due);
                $countryInvoiceCount = (clone $countryInvoiceQuery)->count();

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
                    'revenue' => (float) $countryRevenue,
                    'outstanding' => (float) $countryOutstanding,
                    'invoices_count' => $countryInvoiceCount,
                ];
            });

        return response()->json([
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'currency_code' => GroupCurrency::code(),
            'revenue' => (float) $revenue,
            'payments_total' => (float) $payments,
            'expenses_total' => (float) $expenses,
            'net_cash' => round((float) $payments - (float) $expenses, 2),
            'outstanding' => (float) $outstanding,
            'invoices_total' => $invoiceCount,
            'invoices_paid' => $paidCount,
            'clients_total' => $clientCount,
            'new_clients' => $newClients,
            'subscriptions_active' => $activeSubscriptions,
            'average_invoice_value' => $paidCount > 0 ? round((float) $revenue / $paidCount, 2) : 0.0,
            'collection_rate' => ((float) $revenue + (float) $outstanding) > 0
                ? round(((float) $revenue / ((float) $revenue + (float) $outstanding)) * 100, 2)
                : 0.0,
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
        $countryAgencyIds = Agency::where('country_id', $country->id)->pluck('id')->all();
        if ($agencyIds !== null) {
            $allowed = array_intersect($agencyIds, $countryAgencyIds);
            if (empty($allowed)) {
                abort(403, 'Accès refusé pour ce pays.');
            }
            $countryAgencyIds = $allowed;
        }

        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        $invoices = Invoice::whereIn('agency_id', $countryAgencyIds)
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNull('cancelled_at')
            ->validated();

        $revenue = (clone $invoices)->where('status', 'paid')->sum('total_amount');
        $outstanding = (clone $invoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['total_amount', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due);
        $invoiceCount = (clone $invoices)->count();
        $paidCount = (clone $invoices)->where('status', 'paid')->count();

        $payments = InvoicePayment::whereBetween('paid_at', [$from, $to])
            ->whereHas('invoice', fn ($q) => $q->whereIn('agency_id', $countryAgencyIds)->whereNull('cancelled_at')->validated())
            ->sum('amount');

        $advances = InvoicePayment::whereBetween('paid_at', [$from, $to])
            ->where('is_advance', true)
            ->whereHas('invoice', fn ($q) => $q->whereIn('agency_id', $countryAgencyIds)->whereNull('cancelled_at')->validated()->whereIn('status', ['unpaid', 'partial']))
            ->sum('amount');

        $clientCount = User::whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->where('country_id', $country->id)
            ->count();

        $agencyCount = Agency::where('country_id', $country->id)->count();
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
            ->withSum([
                'invoices as revenue' => fn ($q) => $q->whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at')->validated()->where('status', 'paid'),
            ], DB::raw('total_amount * '.GroupCurrency::rateSql('invoices.agency_id')))
            ->withCount([
                'invoices as sales_count' => fn ($q) => $q->whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at')->validated(),
            ])
            ->limit(5)
            ->get()
            ->sortByDesc('revenue')
            ->values()
            ->map(fn (Commercial $c) => [
                'id' => $c->id,
                'first_name' => $c->first_name,
                'last_name' => $c->last_name,
                'email' => $c->email,
                'points_balance' => $c->points_balance,
                'sales_count' => (int) $c->sales_count,
                'revenue' => (float) ($c->revenue ?? 0),
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
            'revenue' => (float) $revenue,
            'payments_total' => (float) $payments,
            'advances_total' => (float) $advances,
            'outstanding' => (float) $outstanding,
            'invoices_total' => $invoiceCount,
            'invoices_paid' => $paidCount,
            'clients_total' => $clientCount,
            'agencies_total' => $agencyCount,
            'departments_total' => $departmentCount,
            'users_total' => $userCount,
            'top_commercials' => $topCommercials,
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
            $countryAgencyIds = Agency::where('country_id', $request->input('country_id'))
                ->pluck('id')
                ->map(fn ($id) => (string) $id)
                ->all();
            $agencyIds = $agencyIds === null
                ? ($countryAgencyIds ?: null)
                : array_values(array_intersect($agencyIds, $countryAgencyIds));
        }

        $service = app(AcademyReportService::class);

        return response()->json([
            'training' => $service->groupStats($agencyIds),
            'services' => $service->groupServices($agencyIds),
        ]);
    }
}
