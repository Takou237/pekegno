<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commercials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->string('first_name', 150);
            $table->string('last_name', 150);
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->enum('commission_type', ['none', 'percent', 'fixed'])->default('none');
            $table->decimal('commission_value', 12, 2)->nullable();
            $table->integer('points_balance')->default(0);
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commercials');
    }
};
