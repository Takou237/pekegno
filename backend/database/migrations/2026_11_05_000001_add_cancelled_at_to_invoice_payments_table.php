<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Paiement annulé avec sa facture (trace, jamais de suppression) — cf.
 * App\Services\InvoiceCancellationService.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable()->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->dropColumn('cancelled_at');
        });
    }
};
