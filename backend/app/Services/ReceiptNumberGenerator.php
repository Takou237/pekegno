<?php

namespace App\Services;

use App\Models\InvoicePayment;
use App\Support\Period;
use Illuminate\Support\Facades\DB;

class ReceiptNumberGenerator
{
    /**
     * Numéro de reçu de versement : REC-AAAAMMJJ-NNN (séquence journalière).
     * Exemple : REC-20260930-001.
     *
     * À appeler dans la même transaction que l'insertion du paiement : le
     * verrou conseil est tenu jusqu'au COMMIT, deux encaissements simultanés
     * ne peuvent donc pas obtenir le même numéro.
     */
    public function next(?string $date = null): string
    {
        $date ??= Period::businessToday()->format('Ymd');
        $prefix = 'REC-'.$date.'-';

        if (DB::getDriverName() === 'pgsql') {
            DB::select('SELECT pg_advisory_xact_lock(?)', [crc32($prefix)]);
        }

        $last = InvoicePayment::where('receipt_number', 'like', $prefix.'%')
            ->orderByDesc('receipt_number')
            ->value('receipt_number');

        $sequence = 1;
        if ($last && preg_match('/-(\d+)$/', (string) $last, $matches)) {
            $sequence = (int) $matches[1] + 1;
        }

        return sprintf('%s%03d', $prefix, $sequence);
    }
}
