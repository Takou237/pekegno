<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Invoice;
use App\Support\GroupCurrency;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Cartes financières des tableaux de bord — SOURCE UNIQUE du calcul
 * (cahier « Corrections demandées », section 1). Toutes les pages (groupe,
 * pays, agence, département, rapports) doivent lire leurs montants ici.
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
 * Contrôle : CA = encaissé sur les factures de la période (à ce jour) + impayés.
 * Panier moyen : CA ÷ nombre de factures validées. Arrondi au franc.
 *
 * Montants convertis dans la monnaie du groupe ($convert) pour les vues
 * multi-pays, laissés en monnaie locale pour un pays / une agence.
 */
class FinancialKpiService
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

        // Factures validées de la période.
        $invoices = DB::table('invoices')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoices.invoice_date', [$from, $to]);
        $scope($invoices, 'invoices');

        $r = $rate('invoices.agency_id');
        $period = $invoices->selectRaw("
            count(*) as nb,
            coalesce(sum(invoices.total_amount * {$r}), 0) as revenue,
            coalesce(sum(invoices.amount_paid * {$r}), 0) as paid,
            coalesce(sum(case when invoices.total_amount > invoices.amount_paid then invoices.total_amount - invoices.amount_paid else 0 end * {$r}), 0) as outstanding,
            coalesce(sum(case when invoices.amount_paid < invoices.total_amount then invoices.amount_paid else 0 end * {$r}), 0) as advances,
            coalesce(sum(case when invoices.amount_paid >= invoices.total_amount then 1 else 0 end), 0) as nb_paid
        ")->first();

        // Encaissements reçus pendant la période.
        $payments = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoice_payments.paid_at', [$from, $to]);
        $scope($payments, 'invoices');

        $collected = $payments->selectRaw('
            coalesce(sum(invoice_payments.amount * '.$r.'), 0) as total,
            coalesce(sum(case when invoices.invoice_date < ? then invoice_payments.amount else 0 end * '.$r.'), 0) as recoveries
        ', [$from])->first();

        // Dépenses de la période (les transferts entre caisses seront exclus avec le module caisses).
        $expenses = DB::table('accounting_transactions')
            ->where('type', 'expense')
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

        $revenue = $this->franc($period->revenue);
        $collectedTotal = $this->franc($collected->total);
        $expensesTotal = $this->franc($expenses);
        $outstanding = $this->franc($period->outstanding);
        $paidOnPeriod = $this->franc($period->paid);
        $count = (int) $period->nb;

        return [
            'revenue' => $revenue,
            'invoices_validated' => $count,
            'invoices_paid' => (int) $period->nb_paid,
            'collected' => $collectedTotal,
            'recoveries' => $this->franc($collected->recoveries),
            'collected_on_period_invoices' => $paidOnPeriod,
            'advances' => $this->franc($period->advances),
            'outstanding' => $outstanding,
            'expenses' => $expensesTotal,
            'pending_validation' => $this->franc($pendingRow->announced),
            'pending_validation_total' => $this->franc($pendingRow->total),
            'pending_validation_count' => (int) $pendingRow->nb,
            'net_cash' => $collectedTotal - $expensesTotal,
            'average_basket' => $count > 0 ? $this->franc($revenue / $count) : 0.0,
            'collection_rate' => $revenue > 0 ? round($paidOnPeriod / $revenue * 100, 2) : 0.0,
            // Contrôle du cahier : CA = encaissé sur les factures de la période + impayés.
            'control_ok' => abs($revenue - ($paidOnPeriod + $outstanding)) < 1,
        ];
    }

    private function franc(mixed $value): float
    {
        return (float) round((float) $value);
    }
}
