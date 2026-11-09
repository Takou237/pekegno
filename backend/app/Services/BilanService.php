<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\CashClosing;
use App\Models\Category;
use App\Models\Department;
use App\Models\TreasuryAccount;
use App\Support\GroupCurrency;
use App\Support\Period;
use App\Support\SaleBranch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BilanService
{
    /**
     * Périmètre « département » : le bilan ne compte alors que les factures et
     * les écritures du département (cf. DepartmentLedger).
     */
    private ?Department $department = null;

    /** Fuseau de la journée métier : celui de l'agence quand une seule est affichée. */
    private ?string $timezone = null;

    /**
     * B14 : vue multi-agences (groupe / pays) — chaque montant est converti dans
     * la monnaie du groupe avant d'être additionné (XOF et XAF ne s'ajoutent
     * pas tels quels). Une agence seule reste dans sa monnaie.
     */
    private bool $convert = false;

    /** Date de réception d'un paiement (B11) : repli sur paid_at pour l'historique. */
    private const RECEIVED_AT = 'coalesce(invoice_payments.received_at, invoice_payments.paid_at)';

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

        $first = $days[0] ?? null;
        $last = $days === [] ? null : $days[array_key_last($days)];

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'agency_id' => $agencyId,
            'agency' => $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null,
            // Colonnes stables du tableau : toutes les catégories du catalogue,
            // même sans vente sur la période (sinon le tableau « disparaît »).
            // Rubriques : Séminaire (services « Pass ») + une par catégorie du catalogue.
            'sale_categories' => collect([SaleBranch::SEMINAR])->concat(Category::query()->orderBy('name')->pluck('name'))->unique()->values()->all(),
            'days' => $days,
            'currency_code' => $this->department
                ? GroupCurrency::currencyForAgency($this->department->agency_id)
                : GroupCurrency::currencyForAgency($agencyId),
            // B5 : les flux s'additionnent, pas les soldes. Total période = solde
            // initial du premier jour et solde final du dernier jour.
            'totals' => [
                'total_ventes_amount' => round((float) collect($days)->sum('total_ventes_amount'), 2),
                'total_received' => round((float) collect($days)->sum('total_received'), 2),
                'expense_total' => round((float) collect($days)->sum('expense_total'), 2),
                'solde_initial' => $first['solde_initial'] ?? 0.0,
                'solde_final' => $last['solde_final'] ?? 0.0,
            ],
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
            'total_bank' => 0,
            'total_depenses' => 0,
            // B6 : solde initial consolidé = somme des soldes finaux des agences la veille.
            'total_solde_initial' => 0,
            'total_solde_final' => 0,
            'total_agency' => 0,
            'total_agency_pass_through' => 0,
        ];

        $expenseByCategory = [];
        $rates = GroupCurrency::agencyRates();

        foreach ($agencies as $agency) {
            $b = $this->buildSingleDay($date, $agency->id);
            $agencyBilans[] = $b;

            // B14 : chaque agence garde sa monnaie ; les totaux sont convertis
            // dans la monnaie du groupe.
            $r = (float) ($rates[$agency->id] ?? 1.0);
            foreach (['total_ventes_amount', 'formation_total', 'total_received', 'cash_total', 'om_total', 'momo_total', 'mobile_total', 'bank_total', 'expense_total', 'solde_initial', 'solde_final', 'agency_total', 'agency_pass_through_total'] as $amountKey) {
                $b[$amountKey] = round((float) $b[$amountKey] * $r, 2);
            }
            $b['expenses_by_category'] = array_map(fn ($c) => ['name' => $c['name'], 'total' => round($c['total'] * $r, 2)], $b['expenses_by_category']);

            $totals['total_ventes'] += $b['total_ventes'];
            $totals['total_ventes_amount'] += $b['total_ventes_amount'];
            $totals['total_formations'] += $b['formation_total'];
            $totals['total_encaisse'] += $b['total_received'];
            $totals['total_cash'] += $b['cash_total'];
            $totals['total_om'] += $b['om_total'];
            $totals['total_momo'] += $b['momo_total'];
            $totals['total_mobile'] += $b['mobile_total'];
            $totals['total_bank'] += $b['bank_total'];
            $totals['total_depenses'] += $b['expense_total'];
            $totals['total_solde_initial'] += $b['solde_initial'];
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
            'currency_code' => GroupCurrency::code(),
            'totals' => $totals,
            'expenses_by_category' => array_values($expenseByCategory),
        ];
    }

    /**
     * Construit le bilan complet d'un seul jour.
     */
    private function buildSingleDay(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $previousTimezone = $this->timezone;
        $previousConvert = $this->convert;
        $this->timezone = $agencyId ? Period::timezoneForAgency(Agency::with('geoCountry')->find($agencyId)) : null;
        $this->convert = $agencyId === null && $this->department === null;

        try {
            return $this->buildDay($date, $agencyId, $agencyIds) + [
                'currency_code' => $this->department
                    ? GroupCurrency::currencyForAgency($this->department->agency_id)
                    : GroupCurrency::currencyForAgency($agencyId),
            ];
        } finally {
            $this->timezone = $previousTimezone;
            $this->convert = $previousConvert;
        }
    }

    private function buildDay(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
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
        $bank = (float) ($received['bank'] ?? 0);

        // Total = somme de TOUS les seaux : aucun encaissement n'est perdu, même
        // sur un mode peu courant (virement, chèque…).
        $totalReceived = $cash + $om + $momo + $mobile + $bank;
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

        // Cahier §2 : les ventes d'un côté, les caisses de l'autre. Le solde de
        // l'agence est celui de ses caisses C/O/M/B…, calculé à partir de leurs
        // mouvements (B6) : le solde initial d'un jour est toujours le solde
        // final de la veille, et rien n'est réécrit quand on consulte le Bilan.
        // Un département n'a pas de caisse : son solde suit ses encaissements
        // moins ses dépenses.
        if ($this->department) {
            $treasury = null;
            $opening = $this->departmentOpeningBalance($date);
            $closing = round($opening + $totalReceived - $expenseTotal, 2);
        } else {
            $treasury = $this->treasuryDay($date, $agencyId, $agencyIds);
            $opening = $treasury['opening'];
            $closing = $treasury['closing'];
        }

        $agency = $agencyId ? Agency::find($agencyId)?->only('id', 'name') : null;

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
            'bank_total' => $bank,
            'total_received' => $totalReceived,
            'expense_total' => (float) $expenseTotal,
            'expenses_by_category' => $expensesByCategory,
            'solde_initial' => $opening,
            'solde_final' => $closing,
            'treasury_accounts' => $treasury['accounts'] ?? [],
        ];
    }

    /**
     * Caisses du périmètre pour une journée : solde initial (fin de la veille),
     * entrées, sorties et solde final de chaque caisse, avec sa clôture du jour
     * si elle existe (solde compté, écart, statut). Chaque agence est lue dans
     * son fuseau, comme la clôture de caisse (CashClosingService).
     *
     * @return array{opening: float, closing: float, accounts: array<int, array<string, mixed>>}
     */
    private function treasuryDay(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $accounts = TreasuryAccount::query()
            ->with('agency.geoCountry')
            ->when($agencyId, fn ($q) => $q->where('agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds))
            ->orderBy('code')
            ->get();

        $closings = CashClosing::query()
            ->whereIn('treasury_account_id', $accounts->pluck('id'))
            ->whereDate('closing_date', $date->toDateString())
            ->get()
            ->keyBy('treasury_account_id');

        $rows = [];
        $opening = 0.0;
        $closing = 0.0;

        $rates = $this->convert ? GroupCurrency::agencyRates() : [];

        foreach ($accounts->groupBy('agency_id') as $agencyId => $agencyAccounts) {
            $timezone = Period::timezoneForAgency($agencyAccounts->first()->agency);
            $rate = (float) ($rates[$agencyId] ?? 1.0);
            [$start, $end] = Period::dayBoundsUtc($date->toDateString(), $timezone);

            $flows = DB::table('treasury_transactions')
                ->whereNull('deleted_at')
                ->whereIn('treasury_account_id', $agencyAccounts->pluck('id'))
                ->where('transacted_at', '<=', $end)
                ->groupBy('treasury_account_id')
                ->selectRaw("
                    treasury_account_id,
                    sum(case when transacted_at < ? then (case when direction = 'in' then amount else -amount end) else 0 end) as before_day,
                    sum(case when transacted_at >= ? and direction = 'in' then amount else 0 end) as day_in,
                    sum(case when transacted_at >= ? and direction = 'out' then amount else 0 end) as day_out
                ", [$start, $start, $start])
                ->get()
                ->keyBy('treasury_account_id');

            foreach ($agencyAccounts as $account) {
                $flow = $flows->get($account->id);
                $accountOpening = round(((float) $account->opening_balance + (float) ($flow->before_day ?? 0)) * $rate, 2);
                $in = round((float) ($flow->day_in ?? 0) * $rate, 2);
                $out = round((float) ($flow->day_out ?? 0) * $rate, 2);
                $accountClosing = round($accountOpening + $in - $out, 2);
                $cashClosing = $closings->get($account->id);

                // Caisse désactivée et vide : rien à montrer.
                if (! $account->is_active && $accountOpening == 0 && $in == 0 && $out == 0) {
                    continue;
                }

                $opening += $accountOpening;
                $closing += $accountClosing;

                $rows[] = [
                    'id' => $account->id,
                    'agency_id' => $account->agency_id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'type' => $account->type,
                    'opening' => $accountOpening,
                    'in' => $in,
                    'out' => $out,
                    'closing' => $accountClosing,
                    'closing_status' => $cashClosing?->status,
                    'counted' => $cashClosing ? (float) $cashClosing->actual_balance : null,
                    'difference' => $cashClosing ? (float) $cashClosing->difference : null,
                ];
            }
        }

        return ['opening' => round($opening, 2), 'closing' => round($closing, 2), 'accounts' => $rows];
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
        $tz = $this->timezone ?? (string) config('app.business_timezone', 'Africa/Douala');
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
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->whereRaw(self::RECEIVED_AT.' between ? and ?', $this->dayBounds($date))
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

    /** Taux de conversion SQL (1 hors vue multi-agences). */
    private function rate(string $agencyColumn): string
    {
        return $this->convert ? GroupCurrency::rateSql($agencyColumn) : '1';
    }

    private function allocated(): string
    {
        return '('.self::ALLOCATED.' * '.$this->rate('invoices.agency_id').')';
    }

    /** Part de l'encaissement du jour revenant à une ligne (cf. paidLines). */
    private const ALLOCATED = 'invoice_items.line_total * paid_today.amount / line_sums.lines_total';

    /**
     * Encaissements du jour groupés par catégorie de service (dynamique).
     *
     * Les lignes liées à une inscription de formation (service_id null + rattachement
     * via formation_enrollments) sont exclues : elles sont comptées séparément
     * dans la colonne « Academy ».
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
                case when services.is_seminar then '".SaleBranch::SEMINAR."' else coalesce(categories.name, '".SaleBranch::UNCATEGORIZED."') end as category,
                coalesce(invoice_items.label, '') as label,
                sum(invoice_items.quantity) as count,
                sum(".$this->allocated().") as total
            ")
            ->groupByRaw("case when services.is_seminar then '".SaleBranch::SEMINAR."' else coalesce(categories.name, '".SaleBranch::UNCATEGORIZED."') end, coalesce(invoice_items.label, '')")
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
                coalesce(categories.name, '".SaleBranch::UNCATEGORIZED."') as category,
                coalesce(invoice_items.label, '') as label,
                sum(invoice_items.quantity) as count,
                sum(".$this->allocated().") as total
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
                sum(".$this->allocated().") as total
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

        $total = (float) (clone $formationLines)->selectRaw('sum('.$this->allocated().') as total')->value('total');

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
     * Encaissements ventilés par mode normalisé : cash, om, momo, mobile, bank.
     *
     * Les libellés bruts de `payment_method` (saisis librement pour certaines
     * preuves : « Mobile Money », « Bank transfer », « orange_money », …) sont
     * ramenés à l'un des 5 seaux, afin qu'aucun encaissement ne disparaisse du
     * total (un mode inconnu est compté en cash).
     */
    private function receivedByMode(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        $buckets = array_fill_keys(RevenueService::MODES, 0.0);

        $rows = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->whereRaw(self::RECEIVED_AT.' between ? and ?', $this->dayBounds($date))
            ->when($this->department, fn ($q) => $q->whereIn('invoices.id', $this->ledger->invoiceIds($this->department)))
            ->when($agencyId, fn ($q) => $q->where('invoices.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds))
            ->selectRaw('invoice_payments.payment_method as method, sum(invoice_payments.amount * '.$this->rate('invoices.agency_id').') as total')
            ->groupBy('invoice_payments.payment_method')
            ->get();

        foreach ($rows as $row) {
            $buckets[RevenueService::normalizeMode($row->method)] += (float) $row->total;
        }

        return array_map(fn ($total) => round($total, 2), $buckets);
    }

    /**
     * Dépenses groupées par catégorie (dynamique).
     */
    private function expensesByCategory(Carbon $date, ?string $agencyId, ?array $agencyIds = null): array
    {
        return DB::table('accounting_transactions')
            ->leftJoin('accounting_categories', 'accounting_categories.id', '=', 'accounting_transactions.category_id')
            ->where('accounting_transactions.type', 'expense')
            ->where('accounting_transactions.is_transfer', false)
            ->whereBetween('accounting_transactions.transacted_at', $this->dayBounds($date))
            ->when($this->department, fn ($q) => $q->where('accounting_transactions.department_id', $this->department->id))
            ->when($agencyId, fn ($q) => $q->where('accounting_transactions.agency_id', $agencyId))
            ->when($agencyId === null && $agencyIds !== null, fn ($q) => $q->whereIn('accounting_transactions.agency_id', $agencyIds))
            ->selectRaw("
                coalesce(accounting_categories.name, 'Autres') as name,
                sum(accounting_transactions.amount * ".$this->rate('accounting_transactions.agency_id').") as total
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

    /**
     * Département : solde cumulé de ses encaissements (date de réception) moins
     * ses dépenses avant ce jour.
     */
    private function departmentOpeningBalance(Carbon $date): float
    {
        $before = $this->dayBounds($date)[0];

        $in = (float) DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', 'validated')
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->whereRaw(self::RECEIVED_AT.' < ?', [$before])
            ->whereIn('invoices.id', $this->ledger->invoiceIds($this->department))
            ->sum('invoice_payments.amount');

        $out = (float) DB::table('accounting_transactions')
            ->where('type', 'expense')
            ->where('is_transfer', false)
            ->where('department_id', $this->department->id)
            ->where('transacted_at', '<', $before)
            ->sum('amount');

        return round($in - $out, 2);
    }
}
