<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * B25 — motif de rejet choisi dans une liste fermée (dont « Date échue »),
     * en complément du texte libre `notes` conservé pour la précision.
     */
    public function up(): void
    {
        Schema::table('payment_proofs', function (Blueprint $table) {
            $table->string('rejection_code', 40)->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('payment_proofs', function (Blueprint $table) {
            $table->dropColumn('rejection_code');
        });
    }
};
