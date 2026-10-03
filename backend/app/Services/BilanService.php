<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\Category;
use App\Models\DailyBalance;
use App\Models\Department;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BilanService
{
    /**
     * Périmètre « département » : le bilan ne compte alors que les factures et
     * les écritures du département (cf. DepartmentLedger).
     */
    private ?Department $department = null;

    public function __construct(private readonly DepartmentLedger $ledger) {}

    /**
     * Bilan journalier — agence unique ou globale, ou un seul département.
     */
    public function daily(Carbon $date, ?string $agencyId, ?string $departmentId = null): array
    {
        return $this->withDepartment($departmentId, fn () => $this->buildSingleDay($date, $agencyId));
    }

    private function withDepartment(?string $departmentId, callable $callback): array
    {
        $previous = $this->department;
        $this->department = $departmentId ? Department::findOrFail($departmentId) : null;

        try {
            $result = $callback();
        } finally {
            $this->department = $previous;
        }

        return $result + ['department_id' => $departmentId];
    }

    /**
     * Bilan sur une plage de dates (une entrée par jour).
     */
    public function period(Carbon $from, Carbon $to, ?string $agencyId, ?array $agencyIds = null, ?string $departmentId = null): array
    {
        if ($departmentId !== null && $this->department === null) {
            return $this->withDepartment($departmentId, fn () => $this->period($from, $to, $agencyId, $agencyIds, $departmentId));
        }

        // Les bornes arrivent en UTC (Period::from/to) : « 01/10 00:00 à Douala »
        // vaut « 30/09 23:00 UTC ». Itérer sur ces instants faisait construire le
        // bilan du 30/09 quand on demandait le 01/10. On revient donc aux jours
        // métier avant de boucler (buildSingleDay recalcule ses bornes UTC).
        $tz = (string) config('app.business_timezone', 'Africa/Douala');
        $from = Carbon::parse($from->copy()->setTimezone($tz)->toDateString());
        $to = Carbon::parse($to->copy()->setTimezone($tz)->toDateString());

        $days = [];
        $current = $from->copy();

        while ($current->lte($to)) {
            $days[] = $this->buildSingleDay($current, $agencyId, $agencyIds);
            $current->addDay();
        }

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null,
            // Colonnes stables du tableau : toutes les catégories du catalogue,
            // même sans vente sur la période (sinon le tableau « disparaît »).
            'sale_categories' => Category::query()->orderBy('name')->pluck('name')->values()->all(),
            'days' => $days,
        ];
    }

    /**
     * Bilan consolidé — agences autorisées, une seule date.
     */
    public function consolidated(Carbon $date, ?array $agencyIds = null): array
    {
        $agencies = Agency::whereNull('deleted_at')
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('id', $agencyIds))
            ->get();

        $agencyBilans = [];
        $totals = [
            'total_ventes' => 0,
            'total_ventes_amount' => 0,
            'total_formations' => 0,
            'total_encaisse' => 0,
            'total_cash' => 0,
            'total_om' => 0,
            'total_momo' => 0,
            'total_mobile' => 0,
            'total_depenses' => 0,
            'total_solde_final' => 0,
            'total_agency' => 0,
            'total_agency_pass_through' => 0,
        ];

        $expenseByCategory = [];

        foreach ($agencies as $agency) {
            $b = $this->buildSingleDay($date, $agency->id);
            $agencyBilans[] = $b;

            $totals['total_ventes'] += $b['total_ventes'];
            $totals['total_ventes_amount'] += $b['total_ventes_amount'];
            $totals['total_formations'] += $b['formation_total'];
            $totals['total_encaisse'] += $b['total_received'];
            $totals['total_cash'] += $b['cash_total'];
            $totals['total_om'] += $b['om_total'];
            $totals['total_momo'] += $b['momo_total'];
            $totals['total_mobile'] += $b['mobile_total'];
            $totals['total_depenses'] += $b['expense_total'];
            $totals['total_solde_final'] += $b['solde_final'];
            $totals['total_agency'] += $b['agency_total'];
            $totals['total_agency_pass_through'] += $b['agency_pass_through_total'];

            foreach ($b['expenses_by_category'] as $cat) {
                $key = $cat['name'];
                if (! isset($expenseByCategory[$key])) {
                    $expenseByCategory[$key] = ['name' => $key, 'total' => 0];
                }
                $expenseByCategory[$key]['total'] += $cat['total'];
            }
        }

        return [
            'date' => $date->toDateString(),
            'agency_id' => null,
            'agency' => null,
            'agencies' => $agencyBilans,
            'totals' => $totals,
            'expenses_by_category' => array_values($expenseByCategory),
        ];
    }

    /**
     * Construit le bilan complet d'un seul jour.
     */
    private function buildSingleDay(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $servicesByCategory = $this->servicesByCategory($date, $agencyId, $agencyIds);
        $productsByCategory = $this->productsByCategory($date, $agencyId, $agencyIds);
        $formationSales = $this->formationSales($date, $agencyId, $agencyIds);
        $agencySales = $this->agencySales($date, $agencyId, $agencyIds);
        $received = $this->receivedByMode($date, $agencyId, $agencyIds);

        $cash = (float) ($received['cash'] ?? 0);
        $om = (float) ($received['om'] ?? 0);
        $momo = (float) ($received['momo'] ?? 0);
        $mobile = (float) ($received['mobile'] ?? 0);

        $totalReceived = $cash + $om + $momo + $mobile;
        $totalVentes = (int) (
            collect($servicesByCategory)->sum('count')
            + collect($productsByCategory)->sum('count')
            + $formationSales['count']
            + collect($agencySales['by_category'])->sum('count')
        );
        $totalVentesAmount = round(
            (float) collect($servicesByCategory)->sum('total')
            + (float) collect($productsByCategory)->sum('total')
            + $formationSales['total']
            // Agency (D7) : seuls les honoraires comptent dans le CA ; le budget
            // publicitaire client (pass-through) en est exclu.
            + $agencySales['total'],
            2
        );

        $expensesByCategory = $this->expensesByCategory($date, $agencyId, $agencyIds);
        $expenseTotal = collect($expensesByCategory)->sum('total');

        $opening = $this->openingBalance($date, $agencyId, $agencyIds);
        $closing = $opening + $totalReceived - $expenseTotal;

        // Les soldes stockés sont ceux de l'agence : pas d'écriture pour une vue département.
        if ($this->department === null && ($agencyId !== null || $agencyIds === null)) {
            $this->storeBalance($date, $agencyId, $opening, $closing);
        }

        $agency = $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null;

        // Solde réel trésorerie (tous les comptes de l'agence) — sans objet pour un département.
        $treasuryBalance = $this->department ? null : $this->treasuryBalance($date, $agencyId, $agencyIds);

        // Écart entre solde théorique et solde réel
        $gap = $treasuryBalance !== null ? round($closing - $treasuryBalance, 2) : null;
        $gapPercent = $treasuryBalance !== null && abs($treasuryBalance) > 0
            ? round(($gap / abs($treasuryBalance)) * 100, 2)
            : null;

        return [
            'date' => $date->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agency,
            'services_by_category' => $servicesByCategory,
            'products_by_category' => $productsByCategory,
            'formation_count' => $formationSales['count'],
            'formation_total' => $formationSales['total'],
            'agency_by_category' => $agencySales['by_category'],
            'agency_total' => $agencySales['total'],
            'agency_pass_through_total' => $agencySales['pass_through_total'],
            'total_ventes' => $totalVentes,
            'total_ventes_amount' => $totalVentesAmount,
            'cash_total' => $cash,
            'om_total' => $om,
            'momo_total' => $momo,
            'mobile_total' => $mobile,
            'total_received' => $totalReceived,
            'expense_total' => (float) $expenseTotal,
            'expenses_by_category' => $expensesByCategory,
            'solde_initial' => $opening,
            'solde_final' => $closing,
            'treasury_balance' => $treasuryBalance,
            'gap' => $gap,
            'gap_percent' => $gapPercent,
        ];
    }

    /**
     * Solde réel de la trésorerie (tous les comptes actifs d'une agence).
     */
    private function treasuryBalance(Carbon $date, ?string $agencyId, ?array $agencyIds = null): ?float
    {
        $accounts = TreasuryAccount::active()
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->get();

        if ($accounts->isEmpty()) {
            return null;
        }

        $total = 0.0;
        foreach ($accounts as $account) {
            $in = TreasuryTransaction::ofAccount($account->id)
                ->where('transacted_at', '<=', $this->dayBounds($date)[1])
                ->where('direction', 'in')
                ->sum('amount');
            $out = TreasuryTransaction::ofAccount($account->id)
                ->where('transacted_at', '<=', $this->dayBounds($date)[1])
                ->where('direction', 'out')
                ->sum('amount');

            $total += (float) $account->opening_balance + (float) $in - (float) $out;
        }

        return round($total, 2);
    }

    /**
     * Bornes UTC d'une journée métier (Africa/Douala). Les dates sont stockées
     * en UTC : `whereDate` classait une vente de 00:02 à Douala (23:02 UTC) la
     * veille. Une date saisie sans heure (00:00) reste bien sur son jour.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    private function dayBounds(Carbon $date): array
    {
        $tz = (string) config('app.business_timezone', 'Africa/Douala');
        $day = Carbon::parse($date->toDateString(), $tz);

        return [$day->copy()->startOfDay()->utc(), $day->copy()->endOfDay()->utc()];
    }

    /**
     * Lignes de facture des factures encaissées dans la journée, avec la part de
     * l'encaissement du jour qui leur revient (colonne `allocated`).
     *
     * Le bilan affiche ce qui est réellement encaissé, pas le montant facturé :
     * une inscription à 50 000 payée 10 000 compte pour 10 000 ce jour-là, le
     * reste sera compté le jour où il est versé. L'encaissement d'une facture est
     * réparti sur ses lignes au prorata de leur montant (remise/TVA comprises),
     * si bien que les colonnes de ventes totalisent exactement le « Total encaissé ».
     */
    private function paidLines(Carbon $date, ?string $agencyId, ?array $agencyIds = null)
    {
        $paidToday = DB::table('invoice_payments')
            ->whereBetween('paid_at', $this->dayBounds($date))
            ->groupBy('invoice_id')
            ->selectRaw('invoice_id, sum(amount) as amount');

        $lineSums = DB::table('invoice_items')
            ->groupBy('invoice_id')
            ->selectRaw('invoice_id, sum(line_total) as lines_total');

        return DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->joinSub($paidToday, 'paid_today', 'paid_today.invoice_id', '=', 'invoices.id')
            ->joinSub($lineSums, 'line_sums', 'line_sums.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->where('line_sums.lines_total', '>', 0)
            ->when($this->department, fn ($q) => $q->whereIn('invoices.id', $this->ledger->invoiceIds($this->department)))
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds));
    }

    /** Part de l'encaissement du jour revenant à une ligne (cf. paidLines). */
    private const ALLOCATED = 'invoice_items.line_total * paid_today.amount / line_sums.lines_total';

    /**
     * Encaissements du jour groupés par catégorie de service (dynamique).
     *
     * Les lignes liées à une inscription de formation (service_id null + rattachement
     * via formation_enrollments) sont exclues : elles sont comptées séparément
     * dans la colonne « Formations ».
     */
    private function servicesByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return $this->paidLines($date, $agencyId, $agencyIds)
            ->leftJoin('services', 'services.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories', 'categories.id', '=', 'services.category_id')
            ->leftJoin('formation_enrollments', function ($join) {
                $join->on('formation_enrollments.invoice_id', '=', 'invoice_items.invoice_id')
                    ->whereNull('invoice_items.service_id')
                    ->whereNull('invoice_items.product_id');
            })
            ->whereNull('invoice_items.product_id')
            ->whereNull('invoice_items.package_id')
            ->whereNull('invoice_items.prestation_id')
            ->whereNull('formation_enrollments.id')
            ->selectRaw("
                coalesce(categories.name, 'Autres') as category,
                coalesce(invoice_items.label, '') as label,
                sum(invoice_items.quantity) as count,
                sum(".self::ALLOCATED.") as total
            ")
            ->groupBy('category', 'label')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'label' => $row->label,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    /**
     * Encaissements du jour sur des produits, groupés par catégorie (dynamique).
     */
    private function productsByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return $this->paidLines($date, $agencyId, $agencyIds)
            ->leftJoin('products', 'products.id', '=', 'invoice_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->whereNotNull('invoice_items.product_id')
            ->selectRaw("
                coalesce(categories.name, 'Autres') as category,
                coalesce(invoice_items.label, '') as label,
                sum(invoice_items.quantity) as count,
                sum(".self::ALLOCATED.") as total
            ")
            ->groupBy('category', 'label')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'label' => $row->label,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    /**
     * Agency : encaissements du jour sur les packages et prestations, par
     * catégorie Agency. Les lignes de budget publicitaire client (pass-through,
     * D7/D15) sont totalisées à part et exclues du CA.
     *
     * @return array{by_category: array<int, array>, total: float, pass_through_total: float}
     */
    private function agencySales(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $rows = $this->paidLines($date, $agencyId, $agencyIds)
            ->leftJoin('subscription_packs', 'subscription_packs.id', '=', 'invoice_items.package_id')
            ->leftJoin('prestations', 'prestations.id', '=', 'invoice_items.prestation_id')
            ->leftJoin('agency_categories', 'agency_categories.id', '=', DB::raw('coalesce(subscription_packs.category_id, prestations.category_id)'))
            ->where(fn ($q) => $q->whereNotNull('invoice_items.package_id')->orWhereNotNull('invoice_items.prestation_id'))
            ->selectRaw("
                coalesce(agency_categories.name, 'Agency') as sale_category,
                case when invoice_items.package_id is not null then 'package' else 'prestation' end as item_kind,
                invoice_items.is_pass_through as item_pass_through,
                sum(invoice_items.quantity) as count,
                sum(".self::ALLOCATED.") as total
            ")
            // Alias distincts des colonnes réelles (agency_categories.kind) : PostgreSQL
            // résoudrait sinon le GROUP BY sur la colonne et non sur l'expression.
            ->groupByRaw("coalesce(agency_categories.name, 'Agency'), case when invoice_items.package_id is not null then 'package' else 'prestation' end, invoice_items.is_pass_through")
            ->get();

        $passThrough = round((float) $rows->filter(fn ($r) => (bool) $r->item_pass_through)->sum('total'), 2);

        $byCategory = $rows
            ->reject(fn ($r) => (bool) $r->item_pass_through)
            ->map(fn ($row) => [
                'category' => $row->sale_category,
                'kind' => $row->item_kind,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->sortByDesc('total')
            ->values()
            ->all();

        return [
            'by_category' => $byCategory,
            'total' => round((float) collect($byCategory)->sum('total'), 2),
            'pass_through_total' => $passThrough,
        ];
    }

    /**
     * Encaissements du jour sur des inscriptions de formation.
     *
     * Part de l'encaissement revenant aux lignes « formation » (ni service ni
     * produit) des factures d'inscription ; le nombre est celui des inscriptions
     * ayant reçu un versement ce jour-là.
     */
    private function formationSales(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $formationLines = $this->paidLines($date, $agencyId, $agencyIds)
            ->whereNull('invoice_items.service_id')
            ->whereNull('invoice_items.product_id')
            ->whereExists(fn ($q) => $q->selectRaw('1')
                ->from('formation_enrollments')
                ->whereColumn('formation_enrollments.invoice_id', 'invoices.id'));

        $total = (float) (clone $formationLines)->selectRaw('sum('.self::ALLOCATED.') as total')->value('total');

        $rows = DB::table('formation_enrollments')
            ->leftJoin('courses', 'courses.id', '=', 'formation_enrollments.course_id')
            ->whereIn('formation_enrollments.invoice_id', (clone $formationLines)->select('invoices.id'))
            ->selectRaw('coalesce(courses.mode, ?) as mode, count(distinct formation_enrollments.id) as count', ['in_person'])
            ->groupBy('mode')
            ->get();

        $count = (int) $rows->sum('count');

        return [
            'count' => $count,
            'total' => round($total, 2),
            'by_mode' => $rows->map(fn ($row) => [
                'mode' => $row->mode,
                'count' => (int) $row->count,
            ])->values()->all(),
        ];
    }

    /**
     * Encaissements ventilés par mode: cash, om, momo, mobile.
     */
    private function receivedByMode(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereBetween('invoice_payments.paid_at', $this->dayBounds($date))
            ->when($this->department, fn ($q) => $q->whereIn('invoices.id', $this->ledger->invoiceIds($this->department)))
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw('invoice_payments.payment_method, sum(invoice_payments.amount) as total')
            ->groupBy('invoice_payments.payment_method')
            ->pluck('total', 'invoice_payments.payment_method')
            ->map(fn ($total) => round((float) $total, 2))
            ->all();
    }

    /**
     * Dépenses groupées par catégorie (dynamique).
     */
    private function expensesByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('accounting_transactions')
            ->leftJoin('accounting_categories', 'accounting_categories.id', '=', 'accounting_transactions.category_id')
            ->where('accounting_transactions.type', 'expense')
            ->whereBetween('accounting_transactions.transacted_at', $this->dayBounds($date))
            ->when($this->department, fn ($q) => $q->where('accounting_transactions.department_id', $this->department->id))
            ->when($agencyId, fn ($q) => $q->where('accounting_transactions.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('accounting_transactions.agency_id', $agencyIds))
            ->selectRaw("
                coalesce(accounting_categories.name, 'Autres') as name,
                sum(accounting_transactions.amount) as total
            ")
            ->groupBy('name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'total' => round((float) $row->total, 2),
            ])
            ->values()
            ->all();
    }

    private function openingBalance(Carbon $date, ?string $agencyId, ?array $agencyIds = null): float
    {
        // Département : solde cumulé de ses encaissements moins ses dépenses avant ce jour.
        if ($this->department) {
            $before = $this->dayBounds($date)[0];

            $in = (float) DB::table('invoice_payments')
                ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
                ->whereNull('invoices.cancelled_at')
                ->where('invoices.validation_status', 'validated')
                ->where('invoice_payments.paid_at', '<', $before)
                ->whereIn('invoices.id', $this->ledger->invoiceIds($this->department))
                ->sum('invoice_payments.amount');

            $out = (float) DB::table('accounting_transactions')
                ->where('type', 'expense')
                ->where('department_id', $this->department->id)
                ->where('transacted_at', '<', $before)
                ->sum('amount');

            return round($in - $out, 2);
        }

        // Vue multi-agences : somme des soldes initiaux de chaque agence, pour que
        // le consolidé corresponde exactement aux tableaux par agence (l'ancienne
        // requête « agency_id nul ET parmi ces agences » ne trouvait jamais rien).
        if ($agencyId === null) {
            $ids = $agencyIds ?? Agency::whereNull('deleted_at')->pluck('id')->all();

            return round(array_sum(array_map(fn ($id) => $this->openingBalance($date, $id), $ids)), 2);
        }

        $previous = $date->copy()->subDay();

        $stored = DailyBalance::query()
            ->where('date', $previous->toDateString())
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId), fn ($q) => $q->whereNull('agency_id'))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->first();

        if ($stored) {
            return (float) $stored->solde_final;
        }

        $received = $this->receivedByMode($previous, $agencyId, $agencyIds);

        return (float) array_sum($received);
    }

    private function storeBalance(Carbon $date, ?string $agencyId, float $opening, float $closing): DailyBalance
    {
        $balance = DailyBalance::query()
            ->where('date', $date->toDateString())
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId), fn ($q) => $q->whereNull('agency_id'))
            ->first();

        if ($balance) {
            $balance->update([
                'solde_initial' => $opening,
                'solde_final' => $closing,
            ]);

            return $balance;
        }

        return DailyBalance::create([
            'agency_id' => $agencyId,
            'date' => $date->toDateString(),
            'solde_initial' => $opening,
            'solde_final' => $closing,
        ]);
    }
}
