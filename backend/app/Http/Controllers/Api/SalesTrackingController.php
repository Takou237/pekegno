<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Support\GroupCurrency;
use App\Support\Period;
use App\Support\SaleBranch;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenApi\Attributes as OA;

/**
 * Suivi des ventes : liste ligne par ligne (article/service) des ventes
 * validées d'une période, avec filtres, KPI et pagination.
 *
 * Montants : le facturé d'une ligne est le total réellement facturé de sa
 * facture (après remise, TVA incluse) réparti au prorata des lignes ; l'encaissé
 * est le montant payé de la facture réparti selon le même prorata — cohérent avec
 * le rapport commercial mensuel (voir CommercialMonthlyReportService).
 */
class SalesTrackingController extends Controller
{
    #[OA\Get(
        path: '/api/sales-tracking',
        summary: 'Suivi des ventes : lignes détaillées, filtres, KPI et pagination',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'seller_user_id', in: 'query', description: 'Vendeur (user id : caissier / commercial au guichet)', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'cashier_id', in: 'query', description: 'Caissier ayant encaissé (invoice_payments.received_by)', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'city', in: 'query', description: 'Ville du client ou de l\'agence', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'activity', in: 'query', description: 'Libellé de la ligne (article/service)', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'type', in: 'query', description: 'Branche (SaleBranch)', schema: new OA\Schema(type: 'string', enum: ['academy', 'agency', 'store', 'studio', 'other'])),
            new OA\Parameter(name: 'status', in: 'query', description: 'Statut de paiement (payé/partiel/impayé, séparable par virgule)', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche numéro de facture ou client', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lignes paginées + KPI (facturé, encaissé, reste, taux)'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $from = Period::from($request, Carbon::now()->startOfMonth());
        $to = Period::to($request);

        if ($from->gt($to)) {
            return response()->json(['message' => 'La date de début doit précéder la date de fin.'], 422);
        }

        $activity = $request->input('activity');
        $type = in_array($request->input('type'), SaleBranch::BRANCHES, true) ? $request->input('type') : null;

        $invoiceBase = Invoice::query()
            ->where('validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereNull('cancelled_at')
            ->whereBetween('invoice_date', [$from, $to]);

        // Périmètre organisationnel : un utilisateur restreint ne voit que ses
        // agences (user_assignments, chef de département, commercial). Sans ce
        // filtre, le suivi mélangeait les agences et les caissiers hors scope
        // affichaient 0 une fois filtrés côté front.
        $scopeAgencyIds = app(\App\Services\ScopeService::class)->agencyIds($user);
        if ($scopeAgencyIds !== null) {
            $invoiceBase->whereIn('agency_id', $scopeAgencyIds);
        }

        // Un commercial ne voit que ses propres ventes ; les rôles d'administration
        // voient tout, filtrable par commercial.
        // Cas du commercial sans profil Commercial (compte promu, kind=employe
        // non créé) : l'ancien `where commercial_id = 0000…` garantissait 0 ligne.
        // On retombe alors sur ses ventes de guichet (seller_user_id = user id).
        if ($user?->actsAsCommercial()) {
            // Ses ventes = rattachées à sa fiche OU dont il est le vendeur (ventes
            // saisies avant la création de sa fiche vendeur).
            $profileId = $user->commercialProfile?->id;
            $invoiceBase->where(fn ($q) => $q
                ->where('seller_user_id', $user->id)
                ->when($profileId, fn ($qq) => $qq->orWhere('commercial_id', $profileId)));
        } elseif ($request->filled('commercial_id')) {
            $invoiceBase->where('commercial_id', $request->input('commercial_id'));
        }

        // Ventes de guichet : commercial_id est souvent NULL (vente caissier sans
        // profil commercial, seller_user_id = user id). Ces deux filtres
        // permettent de retrouver les actions d'un caissier précis.
        if ($request->filled('seller_user_id')) {
            $invoiceBase->where('seller_user_id', $request->input('seller_user_id'));
        }
        if ($request->filled('cashier_id')) {
            $cashierId = $request->input('cashier_id');
            $invoiceBase->whereIn('id', \App\Models\InvoicePayment::query()
                ->where('received_by', $cashierId)
                ->select('invoice_id'));
        }

        $invoiceBase
            ->when($request->filled('agency_id'), fn ($q) => $q->where('agency_id', $request->input('agency_id')))
            ->when($request->filled('status'), function ($q) use ($request) {
                $statuses = array_values(array_filter(array_map('trim', explode(',', (string) $request->input('status')))));
                $q->whereIn('status', $statuses);
            })
            ->when($request->filled('city'), fn ($q) => $q->where(function ($q) use ($request) {
                $city = '%'.$request->input('city').'%';
                $q->whereHas('client', fn ($c) => $c->where('city', 'like', $city))
                    ->orWhereHas('agency', fn ($a) => $a->where('city', 'like', $city));
            }))
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $s = '%'.$request->input('search').'%';
                $q->where('number', 'like', $s)
                    ->orWhere('client_name', 'like', $s)
                    ->orWhereHas('client', fn ($c) => $c->where('first_name', 'like', $s)
                        ->orWhere('last_name', 'like', $s)
                        ->orWhere('email', 'like', $s));
            }));

        // Filtres portés par les lignes : une facture est retenue si au moins une
        // de ses lignes correspond (activité, branche).
        if ($activity || $type) {
            $invoiceBase->whereIn('id', $this->itemFilterQuery($activity, $type)->select('invoice_id'));
        }

        // B14 : XOF et XAF ne s'additionnent pas tels quels. Une seule devise dans
        // le résultat : totaux dans cette devise ; plusieurs : convertis dans la
        // monnaie du groupe.
        // Sous-requête (pas de jointure) : les filtres de $invoiceBase ne sont pas
        // qualifiés et deviendraient ambigus.
        $currencies = DB::table('agencies')
            ->join('countries', 'countries.id', '=', 'agencies.country_id')
            ->whereIn('agencies.id', (clone $invoiceBase)->select('agency_id'))
            ->distinct()
            ->pluck('countries.currency_code')
            ->filter()
            ->values();
        $convert = $currencies->count() > 1;
        $totalsCurrency = $convert || $currencies->isEmpty() ? GroupCurrency::code() : (string) $currencies->first();
        $rate = $convert ? GroupCurrency::rateSql('invoices.agency_id') : '1';

        $totalsRow = (clone $invoiceBase)
            ->selectRaw("coalesce(sum(total_amount * {$rate}), 0) as billed, coalesce(sum(amount_paid * {$rate}), 0) as received")
            ->first();

        $billed = (float) $totalsRow->billed;
        $received = (float) $totalsRow->received;

        $itemQuery = InvoiceItem::query()
            ->whereIn('invoice_id', (clone $invoiceBase)->select('id'));
        $this->applyItemFilters($itemQuery, $activity, $type);

        $linesCount = (clone $itemQuery)->count();

        $perPage = min((int) $request->input('per_page', 20), 100);

        $paginator = (clone $itemQuery)
            ->with(['invoice' => fn ($q) => $q->select(
                'id', 'number', 'invoice_date', 'total_amount', 'amount_paid',
                'status', 'client_id', 'client_name', 'agency_id',
                'commercial_id', 'seller_user_id',
            )->with([
                'client:id,first_name,last_name,email,city',
                'agency:id,name,city',
            ])])
            ->orderByDesc(Invoice::select('invoice_date')->whereColumn('invoices.id', 'invoice_items.invoice_id'))
            ->paginate($perPage);

        // Somme brute des lignes de chaque facture de la page : sert à répartir le
        // total réellement facturé (après remise) au prorata.
        $invoiceIds = collect($paginator->items())->pluck('invoice_id')->unique()->values();

        // B24 : branche de chaque ligne selon la règle commune (SaleBranch) — le
        // livre est Store ici comme au tableau de bord, plus « Académie » par défaut.
        $branches = $this->branchesOf(collect($paginator->items())->pluck('id')->all());
        $linesTotals = $invoiceIds->isEmpty() ? collect() : InvoiceItem::query()
            ->whereIn('invoice_id', $invoiceIds)
            ->groupBy('invoice_id')
            ->selectRaw('invoice_id, coalesce(sum(line_total), 0) as lines_total')
            ->pluck('lines_total', 'invoice_id');

        $data = collect($paginator->items())->map(function (InvoiceItem $item) use ($linesTotals, $branches): array {
            $invoice = $item->invoice;
            $total = (float) ($invoice?->total_amount ?? 0);
            $paidTotal = (float) ($invoice?->amount_paid ?? 0);
            $linesTotal = (float) ($linesTotals[$item->invoice_id] ?? 0);
            $gross = (float) $item->line_total;

            $ratio = $linesTotal > 0 ? $gross / $linesTotal : 1.0;
            $billedLine = $total * $ratio;
            $paidLine = $paidTotal * $ratio;
            $balance = max(0.0, $billedLine - $paidLine);

            $client = $invoice?->client;
            $clientName = $invoice?->client_name;
            if (! $clientName && $client) {
                $clientName = trim(($client->first_name ?? '').' '.($client->last_name ?? '')) ?: $client->email;
            }

            return [
                'id' => $item->id,
                'invoice_id' => $item->invoice_id,
                'invoice_number' => $invoice?->number,
                'invoice_date' => $invoice?->invoice_date?->toDateString(),
                'client_id' => $invoice?->client_id,
                'commercial_id' => $invoice?->commercial_id,
                'seller_user_id' => $invoice?->seller_user_id,
                'client' => $clientName ?: '—',
                'city' => $client?->city ?: ($invoice?->agency?->city ?: '—'),
                'activity' => $item->label ?: '—',
                'type' => $branches[$item->id] ?? SaleBranch::OTHER,
                'quantity' => (int) $item->quantity,
                'billed' => round($billedLine, 2),
                'paid' => round($paidLine, 2),
                'balance' => round($balance, 2),
                'status' => $invoice?->status,
                'currency_code' => GroupCurrency::currencyForAgency($invoice?->agency_id),
            ];
        })->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'totals' => [
                'lines' => $linesCount,
                'billed' => round($billed, 2),
                'received' => round($received, 2),
                'balance_due' => round(max(0.0, $billed - $received), 2),
                'collection_rate' => $billed > 0 ? round($received / $billed * 100, 1) : 0.0,
                'currency_code' => $totalsCurrency,
            ],
        ]);
    }

    private function itemFilterQuery(?string $activity, ?string $type)
    {
        $query = InvoiceItem::query();
        $this->applyItemFilters($query, $activity, $type);

        return $query;
    }

    private function applyItemFilters($query, ?string $activity, ?string $type): void
    {
        if ($activity) {
            $query->where('invoice_items.label', 'like', '%'.$activity.'%');
        }
        if ($type) {
            $query->whereIn('invoice_items.id', SaleBranch::joinCatalog(DB::table('invoice_items'))
                ->whereRaw(SaleBranch::branchSql().' = ?', [$type])
                ->select('invoice_items.id'));
        }
    }

    /**
     * @param  array<int, string>  $itemIds
     * @return array<string, string> branche par identifiant de ligne
     */
    private function branchesOf(array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        return SaleBranch::joinCatalog(DB::table('invoice_items'))
            ->whereIn('invoice_items.id', $itemIds)
            ->selectRaw('invoice_items.id as id, '.SaleBranch::branchSql().' as branch')
            ->pluck('branch', 'id')
            ->all();
    }
}
