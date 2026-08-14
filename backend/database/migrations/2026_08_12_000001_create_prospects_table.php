<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prospects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('commercial_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->string('first_name', 150);
            $table->string('last_name', 150);
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('address', 255)->nullable();
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['commercial_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prospects');
    }
};
