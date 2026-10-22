<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
        });

        DB::table('invoices')
            ->whereNull('created_by')
            ->update([
                'created_by' => DB::raw("CASE WHEN validation_status = 'pending' AND validated_by IS NOT NULL THEN validated_by ELSE seller_user_id END"),
            ]);
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });
    }
};
