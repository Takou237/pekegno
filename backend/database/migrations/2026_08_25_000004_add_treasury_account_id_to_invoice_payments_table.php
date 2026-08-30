<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->foreignUuid('treasury_account_id')->nullable()->after('invoice_id')->constrained('treasury_accounts')->nullOnDelete();
        });

        // Backfill portable (PostgreSQL ET SQLite) : chaque paiement hérite du
        // compte caisse (cash) de l'agence de sa facture.
        $payments = DB::table('invoice_payments')
            ->join('invoices', 'invoices.id', '=', 'invoice_payments.invoice_id')
            ->whereNull('invoice_payments.treasury_account_id')
            ->select('invoice_payments.id', 'invoices.agency_id')
            ->get();

        foreach ($payments as $payment) {
            $accountId = DB::table('treasury_accounts')
                ->where('agency_id', $payment->agency_id)
                ->where('type', 'cash')
                ->whereNull('deleted_at')
                ->value('id');

            if ($accountId !== null) {
                DB::table('invoice_payments')
                    ->where('id', $payment->id)
                    ->update(['treasury_account_id' => $accountId]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->dropForeign(['treasury_account_id']);
            $table->dropColumn('treasury_account_id');
        });
    }
};
