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

    private static function isDateOnly(mixed $value): bool
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
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