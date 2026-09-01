<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('commission_payments', 'payment_method')) {
            Schema::table('commission_payments', function (Blueprint $table) {
                $table->string('payment_method', 20)->default('cash')->after('treasury_account_id');
                $table->index('payment_method');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('commission_payments', 'payment_method')) {
            Schema::table('commission_payments', function (Blueprint $table) {
                $table->dropIndex(['payment_method']);
                $table->dropColumn('payment_method');
            });
        }
    }
};