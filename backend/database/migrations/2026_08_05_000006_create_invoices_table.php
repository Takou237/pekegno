<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('number', 30)->unique();
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('commercial_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('seller_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('invoice_date');
            $table->enum('payment_type', ['cash', 'mobile'])->nullable();
            $table->decimal('total_amount', 12, 2);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->enum('status', ['unpaid', 'partial', 'paid', 'cancelled'])->default('unpaid');
            $table->decimal('commission_amount', 12, 2)->nullable();
            $table->integer('points_awarded')->default(0);
            $table->text('comment')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['invoice_date']);
            $table->index(['status']);
            $table->index(['agency_id', 'invoice_date']);
        });

        // FK différée : commercial_points a été créé avant invoices (plan §3, étapes 3 et 6)
        Schema::table('commercial_points', function (Blueprint $table) {
            $table->foreign('invoice_id')->references('id')->on('invoices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commercial_points', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
        });

        Schema::dropIfExists('invoices');
    }
};
