<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 7 — créances échues : échéance de paiement explicite par facture.
 *
 * Quand `due_date` est nulle, l'échéance est calculée à la lecture :
 * `invoice_date` + délai de paiement configurable par agence (30 j par défaut).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('invoice_date');
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['due_date']);
            $table->dropColumn('due_date');
        });
    }
};
