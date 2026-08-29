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
    public static function from(Request $request, ?Carbon $default = null): Carbon
    {
        return $request->date('from')?->startOfDay() ?? ($default ?? Carbon::now()->startOfMonth());
    }

    public static function to(Request $request, ?Carbon $default = null): Carbon
    {
        return $request->date('to')?->endOfDay() ?? ($default ?? Carbon::now()->endOfDay());
    }
}