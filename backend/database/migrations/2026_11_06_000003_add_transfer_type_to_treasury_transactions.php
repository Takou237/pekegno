<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            $table->string('transfer_type', 30)->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            $table->dropColumn('transfer_type');
        });
    }
};
