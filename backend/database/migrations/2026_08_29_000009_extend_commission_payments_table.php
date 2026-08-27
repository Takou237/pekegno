<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->foreignUuid('seller_profile_id')->nullable()->after('commercial_id')->constrained('seller_profiles')->nullOnDelete();
            $table->foreignUuid('commission_entry_id')->nullable()->after('payment_id')->constrained('commission_entries')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('seller_profile_id');
            $table->dropConstrainedForeignId('commission_entry_id');
        });
    }
};
