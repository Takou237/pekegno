<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->foreignUuid('commercial_id')->nullable()->change();
            $table->foreignUuid('invoice_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->foreignUuid('commercial_id')->nullable(false)->change();
            $table->foreignUuid('invoice_id')->nullable(false)->change();
        });
    }
};
