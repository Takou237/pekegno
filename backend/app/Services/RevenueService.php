<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\Invoice;
use App\Support\GroupCurrency;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Source unique de vérité du chiffre d'affaires PEKEGNO : le CA correspond aux
 * ENCAISSEMENTS (invoice_payments) sur factures validées et non annulées — plus
 * jamais le montant facturé (`invoices.total_amount where status = 'paid'`).
 *
 * Le CA net (« fees ») exclut le budget publicitaire client (pass-through),
 * réparti au prorata des lignes de chaque facture, comme AgencyReportService et
 * le bilan du jour. Les montants sont convertis dans la monnaie du groupe au
 * niveau multi-pays (group / organisation), et laissés en monnaie locale dès
 * qu'un pays, une ville ou une agence est sélectionné.
 */
class RevenueService
{
    public const MODE_CASH = 'cash';

    public const MODE_OM = 'om';

    public const MODE_MOMO = 'momo';

    public const MODE_MOBILE = 'mobile';

    public const MODE_BANK = 'bank';

    /** Les 5 seaux de modes de paiement exposés par l'application. */
    public const MODES = [self::MODE_CASH, self::MODE_OM, self::MODE_MOMO, self::MODE_MOBILE, self::MODE_BANK];

    /**
     * Normalise un libellé de mode de paiement (saisi librement pour certaines
     * preuves : « Mobile Money », « Bank transfer », « orange_money », …) en l'un
     * des 5 seaux. Un mode inconnu retombe sur « cash » afin de ne jamais perdre
     * d'encaissement dans le total.
     */
    public static function normalizeMode(?string $method): string
    {
        $key = strtolower(trim((string) $method));
        $key = str_replace([' ', '-', '.'], '_', $key);

        return match (true) {
            in_array($key, ['om', 'orange', 'orange_money', 'orange_mobile'], true) => self::MODE_OM,
            in_array($key, ['momo', 'mtn', 'mtn_momo', 'mobile_money', 'mobilemoney', 'mvola'], true) => self::MODE_MOMO,
            in_array($key, ['mobile', 'moov', 'moov_money', 'moovmoney', 'wave', 'free_money'], true) => self::MODE_MOBILE,
            in_array($key, ['bank', 'bank_transfer', 'virement', 'transfer', 'cheque', 'cheque_bancaire', 'card', 'carte'], true) => self::MODE_BANK,
            default => self::MODE_CASH,
        };
    }

    /**
     * Encaissements validés de la période, agrégés par agence.
     *
     * @param  array{agency_id?: ?string, agency_ids?: ?array, country_id?: ?string, city_id?: ?string, commercial_id?: ?string}  $filters
     * @return Collection<string, array{agency_id: string, total: float, fees: float, payments: int}>
     */
    public function byAgency(Carbon $from, Carbon $to, array $filters = [], bool $convert = false): Collection
    {
        $query = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoice_payments.paid_at', [$from, $to]);

        $this->applyScope($query, $filters);

        $rows = $query
            ->groupBy('invoices.id', 'invoices.agency_id')
            ->selectRaw('invoices.id as invoice_id, invoices.agency_id, sum(invoice_payments.amount) as total, count(*) as payments')
            ->get();

        if ($rows->isEmpty()) {
            return collect();
        }

        $ratios = DB::table('invoice_items')
            ->whereIn('invoice_id', $rows->pluck('invoice_id'))
            ->selectRaw('invoice_id, sum(case when is_pass_through then line_total else 0 end) as pass, sum(line_total) as lines')
            ->groupBy('invoice_id')
            ->get()
            ->keyBy('invoice_id');

        $rates = $convert ? GroupCurrency::agencyRates() : [];

        return $rows
            ->groupBy('agency_id')
            ->map(function (Collection $group, $agencyId) use ($ratios, $convert, $rates) {
                $total = 0.0;
                $fees = 0.0;
                $payments = 0;

                foreach ($group as $row) {
                    $paid = (float) $row->total;
                    $share = $ratios[$row->invoice_id] ?? null;
                    $ratio = $share && (float) $share->lines > 0
                        ? (float) $share->pass / (float) $share->lines
                        : 0.0;

                    $total += $paid;
                    $fees += $paid * (1 - $ratio);
                    $payments += (int) $row->payments;
                }

                $rate = $convert ? (float) ($rates[$agencyId] ?? 1.0) : 1.0;

                return [
                    'agency_id' => (string) $agencyId,
                    'total' => round($total * $rate, 2),
                    'fees' => round($fees * $rate, 2),
                    'payments' => $payments,
                ];
            });
    }

    /**
     * Encaissements validés de la période ventilés par mode de paiement normalisé
     * (cash, om, momo, mobile, bank). `total` est la somme de tous les
     * encaissements : aucun mode n'est perdu, même inconnu.
     *
     * @param  array{agency_id?: ?string, agency_ids?: ?array, country_id?: ?string, city_id?: ?string, commercial_id?: ?string}  $filters
     * @return array{total: float, buckets: array<string, float>, counts: array<string, int>}
     */
    public function byMode(Carbon $from, Carbon $to, array $filters = [], bool $convert = false): array
    {
        $query = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoices.cancelled_at')
            ->where('invoices.validation_status', Invoice::VALIDATION_VALIDATED)
            ->whereBetween('invoice_payments.paid_at', [$from, $to]);

        $this->applyScope($query, $filters);

        $amountExpr = $convert
            ? 'sum(invoice_payments.amount * '.GroupCurrency::rateSql('invoices.agency_id').')'
            : 'sum(invoice_payments.amount)';

        $rows = $query
            ->selectRaw('invoice_payments.payment_method as method, '.$amountExpr.' as total, count(*) as count')
            ->groupBy('invoice_payments.payment_method')
            ->get();

        $buckets = array_fill_keys(self::MODES, 0.0);
        $counts = array_fill_keys(self::MODES, 0);
        $total = 0.0;

        foreach ($rows as $row) {
            $bucket = self::normalizeMode($row->method);
            $amount = (float) $row->total;
            $buckets[$bucket] += $amount;
            $counts[$bucket] += (int) $row->count;
            $total += $amount;
        }

        return [
            'total' => round($total, 2),
            'buckets' => array_map(fn ($value) => round($value, 2), $buckets),
            'counts' => $counts,
        ];
    }

    /**
     * CA net (hors pass-through) encaissé sur la période.
     *
     * @param  array<string, mixed>  $filters
     */
    public function feeTotal(Carbon $from, Carbon $to, array $filters = [], bool $convert = false): float
    {
        return round((float) $this->byAgency($from, $to, $filters, $convert)->sum('fees'), 2);
    }

    /**
     * Encaissements bruts (pass-through compris) sur la période.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paidTotal(Carbon $from, Carbon $to, array $filters = []): float
    {
        return round((float) $this->byAgency($from, $to, $filters)->sum('total'), 2);
    }

    /**
     * @param  \Illuminate\Database\Query\Builder  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyScope($query, array $filters): void
    {
        if (! empty($filters['agency_id'])) {
            $query->where('invoices.agency_id', $filters['agency_id']);
        }

        if (array_key_exists('agency_ids', $filters) && $filters['agency_ids'] !== null) {
            $query->whereIn('invoices.agency_id', $filters['agency_ids']);
        }

        if (! empty($filters['country_id'])) {
            $ids = Agency::idsForCountry($filters['country_id']);
            // Aucune agence rattachée (ni FK ni libellé legacy) : forcer un
            // ensemble vide plutôt qu'un whereIn([]) silencieux côté appelant.
            $query->whereIn('invoices.agency_id', $ids ?: ['00000000-0000-0000-0000-000000000000']);
        }

        if (! empty($filters['city_id'])) {
            $query->whereIn('invoices.agency_id', Agency::where('city_id', $filters['city_id'])->pluck('id'));
        }

        if (! empty($filters['commercial_id'])) {
            $query->where('invoices.commercial_id', $filters['commercial_id']);
        }
    }
}
