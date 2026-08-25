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

        // Backfill: assign each payment to the cash account of its agency
        DB::statement('
            UPDATE invoice_payments ip
            SET treasury_account_id = (
                SELECT ta.id
                FROM treasury_accounts ta
                JOIN invoices i ON i.id = ip.invoice_id
                WHERE ta.agency_id = i.agency_id
                  AND ta.type = \'cash\'
                  AND ta.deleted_at IS NULL
                LIMIT 1
            )
            WHERE ip.treasury_account_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->dropForeign(['treasury_account_id']);
            $table->dropColumn('treasury_account_id');
        });
    }
};
