<?php

namespace App\Support;

use App\Models\Invoice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Chiffre d'affaires d'un commercial — une seule définition pour le tableau
 * de bord du commercial, le classement « Meilleurs commerciaux » et le
 * rapport commercial (cahier §1) :
 *
 * - CA = total des factures VALIDÉES non annulées de la période (date de
 *   facture), budget publicitaire client (lignes pass-through) exclu ;
 * - ventes = quantités vendues sur ces factures ;
 * - factures = nombre de ces factures ; clients = clients distincts.
 *
 * Chaque facture n'est comptée qu'une fois (les lignes sont agrégées à part,
 * jamais jointes avant la somme des totaux).
 */
final class CommercialRevenue
{
    /**
     * @param  array<int, string>|null  $commercialIds  null = tous les commerciaux
     * @param  array<int, string>|null  $agencyIds  périmètre (agence de la facture), null = toutes
     * @return Collection<string, object{commercial_id: string, revenue: float, sales_count: int, invoices: int, clients: int}>
     */
    public static function byCommercial(?Carbon $from, ?Carbon $to, ?array $commercialIds = null, ?array $agencyIds = null, bool $convert = false): Collection
    {
        $lines = DB::table('invoice_items')
            ->selectRaw('invoice_id, coalesce(sum(quantity), 0) as qty, sum(line_total) as lines_total, sum(case when is_pass_through then line_total else 0 end) as pass_total')
            ->groupBy('invoice_id');

        $rate = $convert ? GroupCurrency::rateSql('invoices.agency_id') : '1';
        // `* 1.0` : division décimale aussi sous SQLite.
        $net = 'invoices.total_amount * (1 - coalesce(l.pass_total * 1.0 / nullif(l.lines_total, 0), 0))';

        return DB::table('invoices')
            ->leftJoinSub($lines, 'l', 'l.invoice_id', '=', 'invoices.id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereNotNull('invoices.commercial_id')
            ->when($from, fn ($q) => $q->where('invoices.invoice_date', '>=', $from))
            ->when($to, fn ($q) => $q->where('invoices.invoice_date', '<=', $to))
            ->when($commercialIds !== null, fn ($q) => $q->whereIn('invoices.commercial_id', $commercialIds ?: ['00000000-0000-0000-0000-000000000000']))
            ->when($agencyIds !== null, fn ($q) => $q->whereIn('invoices.agency_id', $agencyIds ?: ['00000000-0000-0000-0000-000000000000']))
            ->groupBy('invoices.commercial_id')
            ->selectRaw("invoices.commercial_id,
                coalesce(sum(({$net}) * {$rate}), 0) as revenue,
                coalesce(sum(l.qty), 0) as sales_count,
                count(*) as invoices,
                count(distinct invoices.client_id) as clients")
            ->get()
            ->map(function ($row) {
                $row->revenue = round((float) $row->revenue, 2);
                $row->sales_count = (int) $row->sales_count;
                $row->invoices = (int) $row->invoices;
                $row->clients = (int) $row->clients;

                return $row;
            })
            ->keyBy('commercial_id');
    }
}
