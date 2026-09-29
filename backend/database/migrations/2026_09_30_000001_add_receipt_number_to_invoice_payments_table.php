<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Numéro de reçu de chaque versement (REC-AAAAMMJJ-NNN) : une facture non
 * soldée ne s'imprime pas, mais chaque versement donne un reçu imprimable.
 * Les versements existants sont numérotés d'après leur date de paiement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->string('receipt_number', 30)->nullable()->unique();
        });

        $timezone = config('app.business_timezone', 'Africa/Douala');
        $sequences = [];

        DB::table('invoice_payments')
            ->whereNull('receipt_number')
            ->orderBy('paid_at')
            ->orderBy('created_at')
            ->select(['id', 'paid_at', 'created_at'])
            ->get()
            ->each(function ($payment) use ($timezone, &$sequences) {
                $date = Carbon::parse($payment->paid_at ?? $payment->created_at, 'UTC')->setTimezone($timezone)->format('Ymd');
                $sequences[$date] = ($sequences[$date] ?? 0) + 1;

                DB::table('invoice_payments')
                    ->where('id', $payment->id)
                    ->update(['receipt_number' => sprintf('REC-%s-%03d', $date, $sequences[$date])]);
            });
    }

    public function down(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->dropUnique(['receipt_number']);
            $table->dropColumn('receipt_number');
        });
    }
};
