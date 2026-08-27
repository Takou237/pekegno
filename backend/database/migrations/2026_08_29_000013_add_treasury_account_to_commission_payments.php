<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->foreignUuid('treasury_account_id')->nullable()->after('invoice_id')->constrained('treasury_accounts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('treasury_account_id');
        });
    }
};
