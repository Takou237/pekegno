<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Les commissions pilotées à la main n'ont pas toujours de facture liée :
// une commission manuelle (prime, régularisation) peut exister sans invoice_id.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('invoice_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('invoice_id')->nullable(false)->change();
        });
    }
};