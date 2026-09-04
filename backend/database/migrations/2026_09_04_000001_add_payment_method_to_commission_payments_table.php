<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->string('payment_method', 30)->nullable()->after('rule');
        });

        DB::table('commission_payments')->whereNull('payment_method')->update(['payment_method' => 'especes']);
    }

    public function down(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
