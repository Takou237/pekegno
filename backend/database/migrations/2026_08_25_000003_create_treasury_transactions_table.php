<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treasury_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('treasury_account_id')->constrained('treasury_accounts')->restrictOnDelete();
            $table->string('direction', 10)->checkIn(['in', 'out']);
            $table->decimal('amount', 12, 2);
            $table->string('source_type', 50)->nullable(); // morph: invoice_payment, expense, transfer, manual
            $table->uuid('source_id')->nullable();
            $table->string('category', 50)->nullable(); // vente, approvisionnement, salaire, autre
            $table->string('label', 200);
            $table->string('reference', 100)->nullable();
            $table->timestamp('transacted_at');
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['treasury_account_id', 'transacted_at']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treasury_transactions');
    }
};
