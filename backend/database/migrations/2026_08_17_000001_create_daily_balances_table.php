<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_balances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->nullable()->constrained('agencies')->nullOnDelete();
            $table->date('date');
            $table->decimal('solde_initial', 12, 2)->default(0);
            $table->decimal('solde_final', 12, 2)->default(0);
            $table->timestamps();

            $table->index(['agency_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_balances');
    }
};
