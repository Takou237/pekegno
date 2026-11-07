<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_closings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('treasury_account_id')->constrained()->cascadeOnDelete();
            $table->date('closing_date');
            $table->decimal('opening_balance', 14, 2)->default(0);
            $table->decimal('theoretical_balance', 14, 2)->default(0);
            $table->decimal('actual_balance', 14, 2)->default(0);
            $table->decimal('difference', 14, 2)->default(0);
            $table->text('justification')->nullable();
            $table->string('status', 20)->default('closed');
            $table->foreignUuid('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();

            $table->unique(['treasury_account_id', 'closing_date']);
            $table->index(['agency_id', 'closing_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_closings');
    }
};
