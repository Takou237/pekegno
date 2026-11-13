<?php

namespace App\Services;

use App\Models\Agency;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Façade historique du chiffre d'affaires.
 *
 * Depuis la décision T0.2, le calcul unique vit dans
 * {@see FinancialMetricsService}. Cette classe est conservée pour ne pas casser
 * les appelants existants (et les constantes de modes de paiement) : elle ne
 * fait que déléguer.
 *
 * Attention : dans l'ancienne doctrine, « CA » signifiait encaissements. Les
 * méthodes de cette façade restent donc des méthodes d'ENCAISSEMENT ; le CA
 * facturé doit être lu via FinancialMetricsService::summary()['ca'].
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

    public function __construct(private readonly FinancialMetricsService $metrics) {}

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
            // Caisse créée par l'administration : rangée selon son type.
            default => match (\App\Support\PaymentMethods::typeOf($key)) {
                \App\Models\TreasuryAccount::TYPE_MOBILE_MONEY => self::MODE_MOBILE,
                \App\Models\TreasuryAccount::TYPE_BANK => self::MODE_BANK,
                default => self::MODE_CASH,
            },
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
        return $this->metrics
            ->byAgency($from, $to, $this->agencyIds($filters), $convert, $filters['commercial_id'] ?? null)
            ->map(fn (array $row) => [
                'agency_id' => $row['agency_id'],
                'total' => Money::franc($row['collected']),
                // Le pass-through est déjà exclu par FinancialMetricsService.
                'fees' => Money::franc($row['collected']),
                'payments' => 0,
            ]);
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
        return $this->metrics->byMode($from, $to, $this->agencyIds($filters), $convert, $filters['commercial_id'] ?? null);
    }

    /**
     * Encaissements nets sur la période.
     *
     * @param  array<string, mixed>  $filters
     */
    public function feeTotal(Carbon $from, Carbon $to, array $filters = [], bool $convert = false): float
    {
        return Money::franc($this->byAgency($from, $to, $filters, $convert)->sum('fees'));
    }

    /**
     * Encaissements bruts sur la période.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paidTotal(Carbon $from, Carbon $to, array $filters = []): float
    {
        return Money::franc($this->byAgency($from, $to, $filters)->sum('total'));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, string>|null null = toutes les agences
     */
    private function agencyIds(array $filters): ?array
    {
        $ids = null;

        if (! empty($filters['agency_id'])) {
            $ids = [$filters['agency_id']];
        }

        if (array_key_exists('agency_ids', $filters)) {
            $ids = $ids === null
                ? $filters['agency_ids']
                : array_values(array_intersect($ids, $filters['agency_ids'] ?? []));
        }

        if (! empty($filters['country_id'])) {
            $countryIds = Agency::idsForCountry($filters['country_id']);
            $ids = $ids === null ? $countryIds : array_values(array_intersect($ids, $countryIds));
        }

        if (! empty($filters['city_id'])) {
            $cityIds = Agency::where('city_id', $filters['city_id'])->pluck('id')->all();
            $ids = $ids === null ? $cityIds : array_values(array_intersect($ids, $cityIds));
        }

        return $ids;
    }
}
