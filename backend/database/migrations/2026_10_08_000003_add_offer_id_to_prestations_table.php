<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lien souscription → offre de prestation. Les prestations générées par un
 * package (D3) restent sans offre : elles se consultent depuis le pack.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prestations', function (Blueprint $table) {
            $table->foreignUuid('offer_id')->nullable()->constrained('prestation_offers')->nullOnDelete();
            $table->index('offer_id');
        });
    }

    public function down(): void
    {
        Schema::table('prestations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('offer_id');
        });
    }
};
