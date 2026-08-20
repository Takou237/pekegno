<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class OrderNumberGenerator
{
    /**
     * Numéro de commande : PREFIXE-AAAAMMJJ-NNN (séquence journalière).
     * Exemple : CMD-20260805-001.
     */
    public function next(?string $date = null, ?string $prefix = null): string
    {
        $date ??= now()->format('Ymd');
        $prefix ??= (string) Setting::get('order_prefix', 'CMD');

        return DB::transaction(function () use ($date, $prefix) {
            if (DB::getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(?)', [$this->lockKey($prefix, $date)]);
            }

            $last = Order::withTrashed()->where('number', 'like', $prefix.'-'.$date.'-%')
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