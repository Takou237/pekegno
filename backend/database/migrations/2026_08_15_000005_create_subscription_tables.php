<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_packs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subscription_pack_services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('subscription_pack_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('service_id')->constrained()->cascadeOnDelete();
            $table->decimal('price_per_month', 12, 2);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('subscription_pack_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('client_id')->constrained('users')->cascadeOnDelete();
            $table->integer('months');
            $table->decimal('price_per_month', 12, 2);
            $table->decimal('total_price', 12, 2);
            $table->date('start_date');
            $table->date('end_date');
            $table->foreignUuid('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['agency_id', 'start_date']);
            $table->index('client_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('subscription_pack_services');
        Schema::dropIfExists('subscription_packs');
    }
};
