<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Normalise une période transmise par le client (from/to).
 * Une date seule (ex: 29/08/2026) est bornée à jour entier : from -> 00:00:00, to -> 23:59:59,
 * sinon les factures/encaissements du jour `to` sont exclus des agrégats.
 */
class Period
{
    private static function businessTimezone(): string
    {
        return (string) config('app.business_timezone', 'Africa/Douala');
    }

    /**
     * Fuseau métier d'une agence : Côte d'Ivoire (XOF) = UTC+0 (Africa/Abidjan),
     * sinon le fuseau métier par défaut (Cameroun, UTC+1). Cahier B29.
     */
    public static function timezoneForAgency(?\App\Models\Agency $agency): string
    {
        return $agency?->geoCountry?->currency_code === 'XOF' ? 'Africa/Abidjan' : self::businessTimezone();
    }

    /**
     * Bornes UTC d'une journée métier (00:00 → 23:59:59 locale).
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function dayBoundsUtc(string $date, string $timezone): array
    {
        $day = Carbon::parse(substr($date, 0, 10), $timezone);

        return [$day->copy()->startOfDay()->utc(), $day->copy()->endOfDay()->utc()];
    }

    private static function isDateOnly(mixed $value): bool
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
    }

    /**
     * Date du jour métier (Africa/Douala) : à 00:30 à Douala il est encore la
     * veille en UTC, et le bilan « du jour » affichait la mauvaise journée.
     */
    public static function businessToday(): Carbon
    {
        return Carbon::parse(Carbon::now(self::businessTimezone())->toDateString());
    }

    public static function from(Request $request, ?Carbon $default = null): Carbon
    {
        $from = $request->input('from');
        if (self::isDateOnly($from)) {
            return Carbon::parse($from, self::businessTimezone())->startOfDay()->utc();
        }

        return $request->date('from')?->startOfDay() ?? ($default ?? Carbon::now()->startOfMonth());
    }

    public static function to(Request $request, ?Carbon $default = null): Carbon
    {
        $to = $request->input('to');
        if (self::isDateOnly($to)) {
            return Carbon::parse($to, self::businessTimezone())->endOfDay()->utc();
        }

        return $request->date('to')?->endOfDay() ?? ($default ?? Carbon::now()->endOfDay());
    }
}
