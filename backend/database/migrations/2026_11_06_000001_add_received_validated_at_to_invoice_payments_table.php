<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->dateTime('received_at')->nullable()->after('paid_at');
            $table->dateTime('validated_at')->nullable()->after('received_at');
            $table->string('validation_status', 20)->default('validated')->after('validated_at');

            $table->index('received_at');
            $table->index('validation_status');
        });

        // Les paiements existants ont été reçus et validés à leur date de
        // règlement : on aligne les nouvelles colonnes sur paid_at.
        DB::table('invoice_payments')
            ->whereNull('received_at')
            ->update([
                'received_at' => DB::raw('paid_at'),
                'validated_at' => DB::raw('paid_at'),
            ]);
    }

    public function down(): void
    {
        Schema::table('invoice_payments', function (Blueprint $table) {
            $table->dropIndex(['received_at']);
            $table->dropIndex(['validation_status']);
            $table->dropColumn(['received_at', 'validated_at', 'validation_status']);
        });
    }
};
