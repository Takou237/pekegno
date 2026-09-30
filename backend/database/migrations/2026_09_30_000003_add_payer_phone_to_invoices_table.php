<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Numéro ayant payé par mobile money (Orange Money / MoMo) : obligatoire
            // pour ces moyens de paiement, absent pour un règlement en espèces.
            $table->string('payer_phone', 50)->nullable()->after('payment_type');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('payer_phone');
        });
    }
};
