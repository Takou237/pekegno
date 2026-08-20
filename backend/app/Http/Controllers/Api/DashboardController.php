<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\City;
use App\Models\Country;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Organization;
use App\Models\User;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use OpenApi\Attributes as OA;

/**
 * Tableau de bord organisationnel (§6 — Dashboard architecture).
 *
 * Navigation progressive : Groupe → Pays → Ville → Agence.
 * Chaque niveau fournit ses KPI et le niveau inférieur est disponible
 * pour la navigation. Le périmètre de l'utilisateur est appliqué côté
 * backend ($3) : un utilisateur restreint ne voit jamais de données
 * hors de ses agences autorisées.
 */
class DashboardController extends Controller
{
    public function __construct(private readonly ScopeService $scopeService) {}

    #[OA\Get(
        path: '/api/dashboard',
        summary: 'Tableau de bord groupe avec navigation hiérarchique (pays, villes, agences)',
        tags: ['Tableau de bord'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'country_id', in: 'query', description: 'Descendre au niveau pays', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'city_id', in: 'query', description: 'Descendre au niveau ville', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', description: 'Descendre au niveau agence', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'KPI et navigation du tableau de bord'),
            new OA\Response(response: 403, description: 'Hors du périmètre autorisé'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $from = $request->date('from') ?? Carbon::now()->startOfMonth();
        $to = $request->date('to') ?? Carbon::now()->endOfDay();

        $user = $request->user();
        $agencyIds = $this->scopeService->agencyIds($user);
        $countryIds = $this->scopeService->countryIds($user);
        $cityIds = $this->scopeService->cityIds($user);

        $agency = null;
        $city = null;
        $country = null;

        if ($request->input('agency_id')) {
            $agency = Agency::with('geoCountry', 'geoCity')->findOrFail($request->input('agency_id'));
            $this->assertInScope($agency->id, $agencyIds);
            $city = $agency->geoCity;
            $country = $agency->geoCountry;
        } elseif ($request->input('city_id')) {
            $city = City::with('country')->findOrFail($request->input('city_id'));
            $country = $city->country;
            $this->assertInScope($city->id, $cityIds);
        } elseif ($request->input('country_id')) {
            $country = Country::findOrFail($request->input('country_id'));
            $this->assertInScope($country->id, $countryIds);
        }

        $agencies = $this->agenciesInLevel($agencyIds, $country, $city, $agency);

        $invoiceQuery = function ($q) use ($agencyIds, $country, $city, $agency) {
            $q->join('agencies', 'agencies.id', '=', 'invoices.agency_id')
                ->when($agencyIds !== null, fn ($inner) => $inner->whereIn('invoices.agency_id', $agencyIds))
                ->when($country, fn ($inner) => $inner->where('agencies.country_id', $country->id))
                ->when($city, fn ($inner) => $inner->where('agencies.city_id', $city->id))
                ->when($agency, fn ($inner) => $inner->where('invoices.agency_id', $agency->id));

            return $q;
        };

        $invoicesBase = static function () use ($from, $to, $invoiceQuery) {
            return $invoiceQuery(
                Invoice::query()
                    ->whereBetween('invoices.invoice_date', [$from, $to])
                    ->whereNull('invoices.cancelled_at')
            );
        };

        $paid = $invoicesBase()
            ->where('invoices.status', 'paid')
            ->selectRaw('invoices.agency_id, sum(invoices.total_amount) as revenue, count(*) as invoices_paid')
            ->groupBy('invoices.agency_id')
            ->get()
            ->keyBy('agency_id');

        $counts = $invoicesBase()
            ->selectRaw('invoices.agency_id, count(*) as invoices_total')
            ->groupBy('invoices.agency_id')
            ->get()
            ->keyBy('agency_id');

        $payments = $invoiceQuery(
            InvoicePayment::query()
                ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
                ->whereBetween('invoice_payments.paid_at', [$from, $to])
        )->sum('invoice_payments.amount');

        $outstanding = $invoicesBase()
            ->whereIn('invoices.status', ['unpaid', 'partial'])
            ->get(['invoices.total_amount', 'invoices.amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due);

        $agenciesPerNode = $agencies->map(fn (Agency $a) => [
            'agency_id' => $a->id,
            'country_id' => $a->country_id,
            'city_id' => $a->city_id,
            'revenue' => (float) ($paid->get($a->id)->revenue ?? 0),
            'invoices_total' => (int) ($counts->get($a->id)->invoices_total ?? 0),
            'invoices_paid' => (int) ($paid->get($a->id)->invoices_paid ?? 0),
        ]);

        return response()->json([
            'scope' => $this->scopePayload($user, $country, $city, $agency),
            'period' => [
                'from' => $from->toISOString(),
                'to' => $to->toISOString(),
            ],
            'kpis' => [
                'revenue' => (float) $agenciesPerNode->sum('revenue'),
                'payments_total' => (float) $payments,
                'outstanding' => (float) $outstanding,
                'invoices_total' => (int) $agenciesPerNode->sum('invoices_total'),
                'invoices_paid' => (int) $agenciesPerNode->sum('invoices_paid'),
                'clients_total' => $this->clientsCount($country, $city, $agency),
                'agencies_total' => $agencies->count(),
            ],
            'navigation' => $this->navigation($agenciesPerNode, $country, $city, $agency),
        ]);
    }

    /**
     * @param  array<int, string>|null  $agencyIds
     */
    private function agenciesInLevel(?array $agencyIds, ?Country $country, ?City $city, ?Agency $agency): Collection
    {
        return Agency::query()
            ->with('geoCountry:id,name,code,currency_code', 'geoCity:id,name,code')
            ->whereNull('deleted_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->when($country, fn ($q) => $q->where('country_id', $country->id))
            ->when($city, fn ($q) => $q->where('city_id', $city->id))
            ->when($agency, fn ($q) => $q->whereKey($agency->id))
            ->orderBy('name')
            ->get();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $perAgency
     */
    private function navigation(Collection $perAgency, ?Country $country, ?City $city, ?Agency $agency): array
    {
        if ($agency) {
            return [];
        }

        if ($city) {
            return [
                'agencies' => $perAgency->map(fn ($a) => [
                    'id' => $a['agency_id'],
                    'name' => $this->agencyName($a['agency_id']),
                    'revenue' => $a['revenue'],
                    'invoices_total' => $a['invoices_total'],
                    'invoices_paid' => $a['invoices_paid'],
                ])->values(),
            ];
        }

        if ($country) {
            $cities = $perAgency
                ->groupBy('city_id')
                ->map(fn (Collection $rows) => [
                    'city_id' => $rows->first()['city_id'],
                    'revenue' => (float) $rows->sum('revenue'),
                    'invoices_total' => (int) $rows->sum('invoices_total'),
                    'invoices_paid' => (int) $rows->sum('invoices_paid'),
                ]);

            return [
                'cities' => City::whereKey($cities->keys()->filter())->get()->map(function (City $c) use ($cities) {
                    $row = $cities->get($c->id, []);

                    return [
                        'id' => $c->id,
                        'name' => $c->name,
                        'code' => $c->code,
                        'revenue' => (float) ($row['revenue'] ?? 0),
                        'invoices_total' => (int) ($row['invoices_total'] ?? 0),
                        'invoices_paid' => (int) ($row['invoices_paid'] ?? 0),
                        'clients_total' => User::where('city_id', $c->id)->whereHas('role', fn ($q) => $q->where('name', 'client'))->count(),
                        'agencies_total' => Agency::where('city_id', $c->id)->count(),
                    ];
                })->values(),
            ];
        }

        $countries = $perAgency
            ->groupBy('country_id')
            ->map(fn (Collection $rows) => [
                'country_id' => $rows->first()['country_id'],
                'revenue' => (float) $rows->sum('revenue'),
                'invoices_total' => (int) $rows->sum('invoices_total'),
                'invoices_paid' => (int) $rows->sum('invoices_paid'),
            ]);

        return [
            'countries' => Country::whereKey($countries->keys()->filter())->get()->map(function (Country $c) use ($countries) {
                $row = $countries->get($c->id, []);

                return [
                    'id' => $c->id,
                    'name' => $c->name,
                    'code' => $c->code,
                    'currency_code' => $c->currency_code,
                    'revenue' => (float) ($row['revenue'] ?? 0),
                    'invoices_total' => (int) ($row['invoices_total'] ?? 0),
                    'invoices_paid' => (int) ($row['invoices_paid'] ?? 0),
                    'clients_total' => User::where('country_id', $c->id)->whereHas('role', fn ($q) => $q->where('name', 'client'))->count(),
                    'agencies_total' => Agency::where('country_id', $c->id)->count(),
                ];
            })->values(),
        ];
    }

    private function agencyName(string $agencyId): string
    {
        static $cache = [];

        return $cache[$agencyId] ??= (Agency::find($agencyId)?->name ?? 'Agence inconnue');
    }

    /**
     * @param  array<int, string>|null  $ids
     */
    private function assertInScope(string $id, ?array $ids): void
    {
        if ($ids !== null && ! in_array($id, $ids, true)) {
            abort(403, 'Cette entité est hors de votre périmètre.');
        }
    }

    private function clientsCount(?Country $country, ?City $city, ?Agency $agency): int
    {
        return User::query()
            ->whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->when($country, fn ($q) => $q->where('country_id', $country->id))
            ->when($city, fn ($q) => $q->where('city_id', $city->id))
            ->when($agency && $agency->geoCity, fn ($q) => $q->where('city_id', $agency->geoCity->id))
            ->count();
    }

    private function scopePayload(?User $user, ?Country $country, ?City $city, ?Agency $agency): array
    {
        $organization = Organization::query()->orderBy('created_at')->first();

        return [
            'type' => $country ? ($city ? ($agency ? 'agency' : 'city') : 'country') : 'organization',
            'organization' => $organization?->only('id', 'name', 'code'),
            'breadcrumb' => collect([
                $this->crumb('organization', $organization?->id, $organization?->name),
                $this->crumb('country', $country?->id, $country?->name),
                $this->crumb('city', $city?->id, $city?->name),
                $this->crumb('agency', $agency?->id, $agency?->name),
            ])->filter(fn ($c) => $c['id'] !== null)->values(),
            'is_global_scope' => $this->scopeService->isGlobal($user),
        ];
    }

    private function crumb(string $type, ?string $id, ?string $name): array
    {
        return ['type' => $type, 'id' => $id, 'name' => $name];
    }
}