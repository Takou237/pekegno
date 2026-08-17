<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->enum('type', ['income', 'expense']);
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('accounting_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('number');
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained('accounting_categories')->nullOnDelete();
            $table->enum('type', ['income', 'expense']);
            $table->string('label');
            $table->string('reference')->nullable();
            $table->decimal('amount', 12, 2);
            $table->foreignUuid('client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('transacted_at');
            $table->foreignUuid('operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();
            $table->string('beneficiary')->nullable();
            $table->string('justification')->nullable();
            $table->timestamps();

            $table->index(['agency_id', 'transacted_at', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_transactions');
        Schema::dropIfExists('accounting_categories');
    }
};
