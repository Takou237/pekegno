<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treasury_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->nullable()->constrained('agencies')->nullOnDelete();
            $table->string('name', 100);
            $table->string('type', 20)->checkIn(['cash', 'mobile_money', 'bank']);
            $table->string('provider', 50)->nullable(); // orange_money, mtn_momo, afriland, cca, other
            $table->string('account_number', 50)->nullable();
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->string('currency_code', 3)->default('XAF');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['agency_id', 'name']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treasury_accounts');
    }
};
