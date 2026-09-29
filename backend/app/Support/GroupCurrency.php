<?php

namespace App\Support;

use App\Models\Agency;
use App\Models\Country;
use App\Models\Setting;

/**
 * Monnaie d'affichage PEKEGNO GROUP et conversion des montants des pays.
 *
 * Chaque facture est libellée dans la monnaie du pays de son agence ; les
 * agrégats multi-pays (niveau groupe) sont convertis via countries.exchange_rate
 * (1 unité locale = exchange_rate unités du groupe).
 */
final class GroupCurrency
{
    public const DEFAULT = 'XAF';

    public static function code(): string
    {
        return (string) (Setting::get('group_currency') ?: self::DEFAULT);
    }

    /**
     * Expression SQL du taux de conversion de l'agence portée par $agencyColumn.
     */
    public static function rateSql(string $agencyColumn): string
    {
        return "coalesce((select gc_countries.exchange_rate from agencies gc_agencies
            join countries gc_countries on gc_countries.id = gc_agencies.country_id
            where gc_agencies.id = {$agencyColumn}), 1)";
    }

    /**
     * Taux par agence, pour les conversions faites en PHP.
     *
     * @return array<string, float>
     */
    public static function agencyRates(): array
    {
        $rates = Country::query()->pluck('exchange_rate', 'id');

        return Agency::withTrashed()->get(['id', 'country_id'])
            ->mapWithKeys(fn (Agency $a) => [$a->id => (float) ($rates[$a->country_id] ?? 1) ?: 1.0])
            ->all();
    }

    /**
     * Monnaie d'une agence (celle de son pays), résolue par requête : ne dépend
     * pas des colonnes chargées sur la relation `agency` (souvent partielles).
     */
    public static function currencyForAgency(?string $agencyId): string
    {
        static $cache = [];

        if (! $agencyId) {
            return self::code();
        }

        return $cache[$agencyId] ??= (string) (Agency::withTrashed()
            ->join('countries', 'countries.id', '=', 'agencies.country_id')
            ->where('agencies.id', $agencyId)
            ->value('countries.currency_code') ?: self::code());
    }

    public static function currencyForCountry(?string $countryId): string
    {
        static $cache = [];

        if (! $countryId) {
            return self::code();
        }

        return $cache[$countryId] ??= (string) (Country::whereKey($countryId)->value('currency_code') ?: self::DEFAULT);
    }
}
