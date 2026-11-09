<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Invoice;
use App\Support\GroupCurrency;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * SOURCE UNIQUE du calcul financier de la plateforme (cahier « Corrections
 * demandées à WORLDEV », section 1, et décision T0.2).
 *
 * | Carte                    | Calcul                                                                 |
 * |--------------------------|------------------------------------------------------------------------|
 * | Chiffre d'affaires       | Total des factures validées (non annulées) de la période (date facture) |
 * | Encaissé                 | Paiements reçus pendant la période, sur factures validées non annulées  |
 * |   dont recouvrements     | … dont paiements de factures datées d'avant la période                  |
 * | Acomptes                 | Déjà versé sur les factures de la période non encore soldées            |
 * | Impayés                  | Reste à payer des factures validées de la période                       |
 * | Dépenses                 | Sorties de la période                                                   |
 * | En attente de validation | Avances annoncées sur les factures en attente de la période             |
 * | Net caisse               | Encaissé − Dépenses                                                     |
 *
 * Contrôle : CA = encaissé sur les factures de la période + impayés.
 * Panier moyen : CA ÷ nombre de factures validées. Arrondi au franc.
 *
 * Les montants sont convertis dans la monnaie du groupe ($convert) pour les vues
 * multi-pays, laissés en monnaie locale pour un pays / une agence.
 * Le budget publicitaire client (lignes `is_pass_through`) est exclu du CA et
 * des encaissements, conformément au plan (T3.12).
 */
class FinancialMetricsService
{
    /**
     * @param  array<int, string>|null  $agencyIds  null = toutes les agences
     * @return array<string, float|int|bool>
     */
    public function summary(Carbon $from, Carbon $to, ?array $agencyIds = null, bool $convert = false, ?string $commercialId = null, ?Department $department = null): array
    {
        $rate = fn (string $agencyColumn) => $convert ? GroupCurrency::rateSql($agencyColumn) : '1';

        // Département : ses factures selon DepartmentLedger (contrats du département,
        // inscriptions pour Academy, ventes sans contrat pour Agency), ses dépenses.
        $departmentInvoices = $department ? app(DepartmentLedger::class)->invoiceIds($department) : null;

        $scope = function ($query, string $table) use ($agencyIds, $commercialId, $departmentInvoices) {
            $query->when($agencyIds !== null, fn ($q) => $q->whereIn("{$table}.agency_id", $agencyIds ?: ['00000000-0000-0000-0000-000000000000']))
                ->when($commercialId, fn ($q) => $q->where("{$table}.commercial_id", $commercialId))
                ->when($departmentInvoices, fn ($q) => $q->whereIn("{$table}.id", DB::query()->fromSub($departmentInvoices, 'dept_invoices')->select('dept_invoices.id')));
        };

        $r = $rate('invoices.agency_id');
        $netFactor = $this->netOfPassThroughFactor();
        $netTotal = $this->netOfPassThroughTotal();

        // Factures validées de la période (budget pub client exclu).
        $invoices = DB::table('invoices')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoices.invoice_date', [$from, $to]);
        $scope($invoices, 'invoices');

        $period = $invoices->selectRaw("
            count(*) as nb,
            coalesce(sum(({$netTotal}) * {$r}), 0) as revenue,
            coalesce(sum((invoices.amount_paid * {$netFactor}) * {$r}), 0) as paid,
            coalesce(sum(case when ({$netTotal}) > (invoices.amount_paid * {$netFactor})
                then ({$netTotal}) - (invoices.amount_paid * {$netFactor}) else 0 end * {$r}), 0) as outstanding,
            coalesce(sum(case when invoices.amount_paid < invoices.total_amount
                then invoices.amount_paid * {$netFactor} else 0 end * {$r}), 0) as advances,
            coalesce(sum(case when invoices.amount_paid >= invoices.total_amount then 1 else 0 end), 0) as nb_paid
        ")->first();

        // Encaissements reçus pendant la période (date de réception, avec repli paid_at).
        $payments = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereRaw('coalesce(invoice_payments.received_at, invoice_payments.paid_at) between ? and ?', [$from, $to]);
        $scope($payments, 'invoices');

        $collected = $payments->selectRaw('
            coalesce(sum(invoice_payments.amount * '.$netFactor.' * '.$r.'), 0) as total,
            coalesce(sum(case when invoices.invoice_date < ? then invoice_payments.amount * '.$netFactor.' else 0 end * '.$r.'), 0) as recoveries
        ', [$from])->first();

        // Dépenses de la période (les transferts entre caisses sont exclus).
        $expenses = DB::table('accounting_transactions')
            ->where('type', 'expense')
            ->where('is_transfer', false)
            ->whereBetween('transacted_at', [$from, $to])
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('agency_id', $agencyIds ?: ['00000000-0000-0000-0000-000000000000']))
            ->when($commercialId, fn ($q) => $q->whereRaw('1 = 0'))
            ->when($department, fn ($q) => $q->where('department_id', $department->id))
            ->sum(DB::raw('amount * '.$rate('accounting_transactions.agency_id')));

        // Ventes annoncées, pas encore validées.
        $pending = DB::table('invoices')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_PENDING)
            ->whereBetween('invoices.invoice_date', [$from, $to]);
        $scope($pending, 'invoices');
        $pendingRow = $pending->selectRaw("
            count(*) as nb,
            coalesce(sum(coalesce(invoices.declared_advance, 0) * {$r}), 0) as announced,
            coalesce(sum(invoices.total_amount * {$r}), 0) as total
        ")->first();

        // … et règlements de reste à payer annoncés par preuve, pas encore acceptés
        // (factures déjà validées) : « montants annoncés par les commerciaux ».
        $pendingProofs = DB::table('payment_proofs')
            ->join('invoices', 'invoices.id', '=', 'payment_proofs.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->where('payment_proofs.status', 'pending')
            ->where('payment_proofs.amount', '>', 0)
            ->whereBetween('payment_proofs.created_at', [$from, $to]);
        $scope($pendingProofs, 'invoices');
        $proofRow = $pendingProofs->selectRaw("
            count(*) as nb,
            coalesce(sum(payment_proofs.amount * {$r}), 0) as announced
        ")->first();
        $pendingAnnounced = (float) $pendingRow->announced + (float) $proofRow->announced;

        $revenue = Money::franc($period->revenue);
        $collectedTotal = Money::franc($collected->total);
        $expensesTotal = Money::franc($expenses);
        $outstanding = Money::franc($period->outstanding);
        $paidOnPeriod = Money::franc($period->paid);
        $count = (int) $period->nb;

        return [
            // Noms du contrat fonctionnel (T0.2 / section 1 du cahier).
            'ca' => $revenue,
            'encaisse' => $collectedTotal,
            'acomptes' => Money::franc($period->advances),
            'impayes' => $outstanding,
            'depenses' => $expensesTotal,
            'en_attente_validation' => Money::franc($pendingAnnounced),
            'net_caisse' => $collectedTotal - $expensesTotal,
            'panier_moyen' => $count > 0 ? Money::franc($revenue / $count) : 0.0,
            // Noms historiques conservés pour ne pas casser les écrans existants.
            'revenue' => $revenue,
            'invoices_validated' => $count,
            'invoices_paid' => (int) $period->nb_paid,
            'collected' => $collectedTotal,
            'recoveries' => Money::franc($collected->recoveries),
            'collected_on_period_invoices' => $paidOnPeriod,
            'advances' => Money::franc($period->advances),
            'outstanding' => $outstanding,
            'expenses' => $expensesTotal,
            'pending_validation' => Money::franc($pendingAnnounced),
            'pending_proofs_count' => (int) $proofRow->nb,
            'pending_validation_total' => Money::franc($pendingRow->total),
            'pending_validation_count' => (int) $pendingRow->nb,
            'net_cash' => $collectedTotal - $expensesTotal,
            'average_basket' => $count > 0 ? Money::franc($revenue / $count) : 0.0,
            'collection_rate' => $revenue > 0 ? round($paidOnPeriod / $revenue * 100, 2) : 0.0,
            // Contrôle du cahier : CA = encaissé sur les factures de la période + impayés.
            'control_ok' => abs($revenue - ($paidOnPeriod + $outstanding)) < 1,
        ];
    }

    /**
     * CA (facturé validé) et encaissé par agence.
     *
     * @param  array<int, string>|null  $agencyIds
     * @return Collection<string, array{agency_id: string, revenue: float, collected: float, outstanding: float, invoices: int}>
     */
    public function byAgency(Carbon $from, Carbon $to, ?array $agencyIds = null, bool $convert = false, ?string $commercialId = null, ?Department $department = null): Collection
    {
        $rate = fn (string $column) => $convert ? GroupCurrency::rateSql($column) : '1';
        $netTotal = $this->netOfPassThroughTotal();

        $invoices = DB::table('invoices')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoices.invoice_date', [$from, $to]);
        $this->applyScope($invoices, $agencyIds, $commercialId, $department);

        $rows = $invoices
            ->groupBy('invoices.agency_id')
            ->selectRaw("invoices.agency_id,
                coalesce(sum(({$netTotal}) * {$rate('invoices.agency_id')}), 0) as revenue,
                coalesce(sum((({$netTotal}) - (invoices.amount_paid * {$this->netOfPassThroughFactor()})) * {$rate('invoices.agency_id')}), 0) as outstanding,
                count(*) as invoices")
            ->get()
            ->keyBy('agency_id');

        $payments = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereRaw('coalesce(invoice_payments.received_at, invoice_payments.paid_at) between ? and ?', [$from, $to]);
        $this->applyScope($payments, $agencyIds, $commercialId, $department);

        $collected = $payments
            ->groupBy('invoices.agency_id')
            ->selectRaw('invoices.agency_id, coalesce(sum(invoice_payments.amount * '.$this->netOfPassThroughFactor().' * '.$rate('invoices.agency_id').'), 0) as total')
            ->get()
            ->keyBy('agency_id');

        $agencyIdsOut = $rows->keys()->merge($collected->keys())->unique();

        return $agencyIdsOut->mapWithKeys(function ($agencyId) use ($rows, $collected) {
            $invoice = $rows->get($agencyId);

            return [$agencyId => [
                'agency_id' => (string) $agencyId,
                'revenue' => Money::franc($invoice->revenue ?? 0),
                'collected' => Money::franc($collected->get($agencyId)->total ?? 0),
                'outstanding' => Money::franc(max(0, (float) ($invoice->outstanding ?? 0))),
                'invoices' => (int) ($invoice->invoices ?? 0),
            ]];
        });
    }

    /**
     * Encaissements validés par mode normalisé (cash, om, momo, mobile, bank).
     *
     * @param  array<int, string>|null  $agencyIds
     * @return array{total: float, buckets: array<string, float>, counts: array<string, int>}
     */
    public function byMode(Carbon $from, Carbon $to, ?array $agencyIds = null, bool $convert = false, ?string $commercialId = null, ?Department $department = null): array
    {
        $rate = fn (string $column) => $convert ? GroupCurrency::rateSql($column) : '1';
        $netFactor = $this->netOfPassThroughFactor();

        $query = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereRaw('coalesce(invoice_payments.received_at, invoice_payments.paid_at) between ? and ?', [$from, $to]);
        $this->applyScope($query, $agencyIds, $commercialId, $department);

        $rows = $query
            ->selectRaw('invoice_payments.payment_method as method,
                coalesce(sum(invoice_payments.amount * '.$netFactor.' * '.$rate('invoices.agency_id').'), 0) as total,
                count(*) as count')
            ->groupBy('invoice_payments.payment_method')
            ->get();

        $buckets = array_fill_keys(RevenueService::MODES, 0.0);
        $counts = array_fill_keys(RevenueService::MODES, 0);
        $total = 0.0;

        foreach ($rows as $row) {
            $bucket = RevenueService::normalizeMode($row->method);
            $amount = (float) $row->total;
            $buckets[$bucket] += $amount;
            $counts[$bucket] += (int) $row->count;
            $total += $amount;
        }

        return [
            'total' => Money::franc($total),
            'buckets' => array_map(fn ($value) => Money::franc($value), $buckets),
            'counts' => $counts,
        ];
    }

    /**
     * Ventilation par catégorie (B4). La catégorie vient de la ligne de facture
     * (`invoice_items.category_id`), avec repli sur le service puis « Sans
     * catégorie ». En attendant les 7 rubriques (T3.6), c'est la seule source.
     *
     * `$basis` :
     * - `revenue` (défaut) : CA facturé validé de la période (T1.6 / metrics) ;
     * - `collected` : part encaissée, répartie au prorata des lignes.
     *
     * @param  array<int, string>|null  $agencyIds
     * @return Collection<int, array{name: string, total: float, items: int}>
     */
    public function byCategory(Carbon $from, Carbon $to, ?array $agencyIds = null, bool $convert = false, ?string $commercialId = null, ?Department $department = null, string $basis = 'revenue'): Collection
    {
        $rate = fn (string $column) => $convert ? GroupCurrency::rateSql($column) : '1';

        // Part encaissée d'une ligne : le paiement de la facture est réparti au
        // prorata de la ligne dans le reste dû hors pass-through, plafonné à la
        // ligne (une facture ne peut pas encaisser plus que son net).
        $amount = $basis === 'collected'
            ? "case when (invoices.total_amount - coalesce(pt.pass_amount, 0)) > 0
                    and invoices.amount_paid >= (invoices.total_amount - coalesce(pt.pass_amount, 0))
                then invoice_items.line_total
                when (invoices.total_amount - coalesce(pt.pass_amount, 0)) > 0
                then invoice_items.line_total * invoices.amount_paid
                    / (invoices.total_amount - coalesce(pt.pass_amount, 0))
                else 0 end"
            : 'invoice_items.line_total';

        $query = DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->leftJoin('services', 'services.id', '=', 'invoice_items.service_id')
            ->leftJoin('categories as item_categories', 'item_categories.id', '=', 'invoice_items.category_id')
            ->leftJoin('categories as service_categories', 'service_categories.id', '=', 'services.category_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->where('invoice_items.is_pass_through', false);
        $this->applyScope($query, $agencyIds, $commercialId, $department);

        $categoryName = "coalesce(item_categories.name, service_categories.name, 'Sans catégorie')";

        return $query
            ->selectRaw("{$categoryName} as name,
                coalesce(sum(({$amount}) * {$rate('invoices.agency_id')}), 0) as total,
                count(*) as items")
            ->groupByRaw($categoryName)
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'total' => Money::franc($row->total),
                'items' => (int) $row->items,
            ]);
    }

    /**
     * CA facturé validé et encaissé par commercial.
     *
     * @param  array<int, string>|null  $agencyIds
     * @return Collection<int, array{commercial_id: string, revenue: float, collected: float, outstanding: float, invoices: int}>
     */
    public function byCommercial(Carbon $from, Carbon $to, ?array $agencyIds = null, bool $convert = false, ?Department $department = null): Collection
    {
        $rate = fn (string $column) => $convert ? GroupCurrency::rateSql($column) : '1';
        $netTotal = $this->netOfPassThroughTotal();
        $netFactor = $this->netOfPassThroughFactor();

        $invoices = DB::table('invoices')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->whereNotNull('invoices.commercial_id');
        $this->applyScope($invoices, $agencyIds, null, $department);

        $rows = $invoices
            ->groupBy('invoices.commercial_id')
            ->selectRaw("invoices.commercial_id,
                coalesce(sum(({$netTotal}) * {$rate('invoices.agency_id')}), 0) as revenue,
                coalesce(sum(case when ({$netTotal}) > (invoices.amount_paid * {$netFactor})
                    then ({$netTotal}) - (invoices.amount_paid * {$netFactor}) else 0 end * {$rate('invoices.agency_id')}), 0) as outstanding,
                count(*) as invoices")
            ->get()
            ->keyBy('commercial_id');

        $payments = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->leftJoinSub($this->passThroughSub(), 'pt', 'pt.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->whereNull('invoice_payments.cancelled_at')
            ->where('invoice_payments.validation_status', 'validated')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereNotNull('invoices.commercial_id')
            ->whereRaw('coalesce(invoice_payments.received_at, invoice_payments.paid_at) between ? and ?', [$from, $to]);
        $this->applyScope($payments, $agencyIds, null, $department);

        $collected = $payments
            ->groupBy('invoices.commercial_id')
            ->selectRaw('invoices.commercial_id, coalesce(sum(invoice_payments.amount * '.$netFactor.' * '.$rate('invoices.agency_id').'), 0) as total')
            ->get()
            ->keyBy('commercial_id');

        return $rows->keys()->merge($collected->keys())->unique()->map(function ($commercialId) use ($rows, $collected) {
            $invoice = $rows->get($commercialId);

            return [
                'commercial_id' => (string) $commercialId,
                'revenue' => Money::franc($invoice->revenue ?? 0),
                'collected' => Money::franc($collected->get($commercialId)->total ?? 0),
                'outstanding' => Money::franc(max(0, (float) ($invoice->outstanding ?? 0))),
                'invoices' => (int) ($invoice->invoices ?? 0),
            ];
        })->values();
    }

    private function passThroughSub()
    {
        return DB::table('invoice_items')
            ->selectRaw('invoice_id, coalesce(sum(case when is_pass_through then line_total else 0 end), 0) as pass_amount')
            ->groupBy('invoice_id');
    }

    private function netOfPassThroughTotal(): string
    {
        return 'case when coalesce(pt.pass_amount, 0) >= invoices.total_amount then 0
            else invoices.total_amount - coalesce(pt.pass_amount, 0) end';
    }

    private function netOfPassThroughFactor(): string
    {
        // `* 1.0` force une division décimale : SQLite fait sinon une division
        // entière (30000 / 100000 = 0), ce qui faussait le prorata en test.
        return 'case when invoices.total_amount > 0 and coalesce(pt.pass_amount, 0) < invoices.total_amount
            then 1.0 - (coalesce(pt.pass_amount, 0) * 1.0 / invoices.total_amount)
            when invoices.total_amount > 0 then 0 else 1 end';
    }

    private function applyScope($query, ?array $agencyIds, ?string $commercialId, ?Department $department): void
    {
        $query->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds ?: ['00000000-0000-0000-0000-000000000000']))
            ->when($commercialId, fn ($q) => $q->where('invoices.commercial_id', $commercialId))
            ->when($department, fn ($q) => $q->whereIn('invoices.id', DB::query()
                ->fromSub(app(DepartmentLedger::class)->invoiceIds($department), 'dept_invoices')
                ->select('dept_invoices.id')));
    }
}
