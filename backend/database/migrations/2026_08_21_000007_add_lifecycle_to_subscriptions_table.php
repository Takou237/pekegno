<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('status')->default('active')->index();
            $table->date('cancelled_at')->nullable();
            $table->index(['end_date', 'status']);
            $table->index('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex(['end_date', 'status']);
            $table->dropIndex('subscriptions_end_date_index');
            $table->dropColumn(['status', 'cancelled_at']);
        });
    }
};