<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignUuid('invoice_payment_id')->nullable()->constrained('invoice_payments')->nullOnDelete();
            $table->foreignUuid('commission_rule_id')->constrained('commission_rules')->restrictOnDelete();
            $table->jsonb('rule_snapshot'); // copie intégrale de la règle appliquée
            $table->foreignUuid('beneficiary_commercial_id')->constrained('commercials')->restrictOnDelete();
            $table->decimal('base_amount', 14, 2);
            $table->decimal('amount', 14, 2);
            $table->string('status', 20)->default('calculated')
                ->checkIn(['calculated', 'validated', 'paid', 'cancelled']);
            $table->foreignUuid('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->foreignUuid('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index('invoice_id');
            $table->index('status');
            $table->index(['beneficiary_commercial_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_entries');
    }
};