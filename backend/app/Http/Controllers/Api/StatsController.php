<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Commercial;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
        $from = $request->date('from') ?? Carbon::now()->startOfMonth();
        $to = $request->date('to') ?? Carbon::now()->endOfDay();

        $invoices = Invoice::whereBetween('invoice_date', [$from, $to])->whereNull('cancelled_at');

        $revenue = (clone $invoices)->where('status', 'paid')->sum('total_amount');
        $outstanding = (clone $invoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['total_amount', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due);
        $invoiceCount = (clone $invoices)->count();
        $paidCount = (clone $invoices)->where('status', 'paid')->count();

        $payments = InvoicePayment::whereBetween('paid_at', [$from, $to])->sum('amount');
        $advances = InvoicePayment::whereBetween('paid_at', [$from, $to])->where('is_advance', true)->sum('amount');

        $clientCount = User::whereHas('role', fn ($q) => $q->where('name', 'client'))->count();
        $activeCommercials = Commercial::where('is_active', true)->count();

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
        $from = $request->date('from') ?? Carbon::now()->startOfMonth();
        $to = $request->date('to') ?? Carbon::now()->endOfDay();

        $invoices = Invoice::where('agency_id', $agency->id)
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNull('cancelled_at');

        $revenue = (clone $invoices)->where('status', 'paid')->sum('total_amount');
        $salesCount = (clone $invoices)->count();
        $outstanding = (clone $invoices)
            ->whereIn('status', ['unpaid', 'partial'])
            ->get(['total_amount', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->balance_due);

        $top = (clone $invoices)
            ->where('status', 'paid')
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
        responses: [
            new OA\Response(response: 200, description: 'Série mensuelle'),
        ]
    )]
    public function monthlyRevenue(Request $request): JsonResponse
    {
        $months = (int) $request->integer('months', 12);
        $months = min(max($months, 3), 24);

        $start = Carbon::now()->subMonths($months - 1)->startOfMonth();

        $rows = Invoice::whereNull('cancelled_at')
            ->where('invoice_date', '>=', $start)
            ->where('status', 'paid')
            ->selectRaw(
                "to_char(invoice_date, 'YYYY-MM') as month, "
                .'sum(total_amount) as total, count(*) as count'
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
                'label' => $month->translatedFormat('M Y'),
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

        $from = $request->date('from') ?? Carbon::now()->startOfYear();

        $commercials = Commercial::with('agency:id,name,code')
            ->whereHas('invoices', fn ($q) => $q->where('status', 'paid')->whereNull('cancelled_at')->where('invoice_date', '>=', $from))
            ->withSum(['invoices as turnover' => fn ($q) => $q->where('status', 'paid')->whereNull('cancelled_at')->where('invoice_date', '>=', $from)], 'total_amount')
            ->withCount(['invoices as sales_count' => fn ($q) => $q->where('status', 'paid')->whereNull('cancelled_at')->where('invoice_date', '>=', $from)])
            ->orderByDesc('turnover')
            ->limit($limit)
            ->get()
            ->map(fn (Commercial $c) => [
                'id' => $c->id,
                'full_name' => $c->full_name,
                'agency' => $c->agency?->name,
                'points_balance' => $c->points_balance,
                'turnover' => (float) $c->turnover,
                'sales_count' => $c->sales_count,
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
        $from = $request->date('from') ?? Carbon::now()->startOfYear();
        $to = $request->date('to') ?? Carbon::now()->endOfDay();

        $rows = InvoiceItem::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->join('services', 'services.id', '=', 'invoice_items.service_id')
            ->join('categories', 'categories.id', '=', 'services.category_id')
            ->whereNull('invoices.cancelled_at')
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->selectRaw('categories.name, sum(invoice_items.line_total) as total, count(*) as items')
            ->groupBy('categories.name')
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
        $from = $request->date('from') ?? Carbon::now()->startOfYear();
        $to = $request->date('to') ?? Carbon::now()->endOfDay();

        $rows = InvoicePayment::whereBetween('paid_at', [$from, $to])
            ->selectRaw('payment_method, sum(amount) as total, count(*) as count')
            ->groupBy('payment_method')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'total' => (float) $row->total,
                'count' => (int) $row->count,
            ]);

        return response()->json($rows);
    }
}
