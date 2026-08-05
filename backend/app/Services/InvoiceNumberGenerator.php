<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class InvoiceNumberGenerator
{
    /**
     * Numéro de facture : PREFIXE-AAAAMMJJ-NNN (séquence journalière).
     * Exemple : PK-20260805-001.
     */
    public function next(?string $date = null, ?string $prefix = null): string
    {
        $date ??= now()->format('Ymd');
        $prefix ??= (string) Setting::get('invoice_prefix', 'PK');

        return DB::transaction(function () use ($date, $prefix) {
            // Verrou conseil PostgreSQL : exclusion mutuelle sur séquence journalière
            if (DB::getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(?)', [$this->lockKey($prefix, $date)]);
            }

            $last = Invoice::where('number', 'like', $prefix.'-'.$date.'-%')
                ->orderByDesc('number')
                ->value('number');

            $sequence = 1;
            if ($last && preg_match('/-(\d+)$/', (string) $last, $matches)) {
                $sequence = (int) $matches[1] + 1;
            }

            return sprintf('%s-%s-%03d', $prefix, $date, $sequence);
        });
    }

    private function lockKey(string $prefix, string $date): int
    {
        return crc32($prefix.$date);
    }
}
