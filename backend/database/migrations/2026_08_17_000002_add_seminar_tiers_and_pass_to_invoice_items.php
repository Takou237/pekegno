<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->boolean('is_seminar')->default(false);
        });

        Schema::create('seminar_tiers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('service_id')->constrained()->cascadeOnDelete();
            $table->enum('tier', ['classique', 'premium', 'vip']);
            $table->string('label');
            $table->decimal('price', 12, 2);
            $table->string('description')->nullable();
            $table->timestamps();
            $table->unique(['service_id', 'tier']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->string('pass_tier')->nullable();
            $table->string('pass_label')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn(['pass_tier', 'pass_label']);
        });

        Schema::dropIfExists('seminar_tiers');

        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('is_seminar');
        });
    }
};
