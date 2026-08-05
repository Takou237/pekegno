<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commercial_points', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('commercial_id')->constrained()->cascadeOnDelete();
            $table->integer('points');
            $table->enum('reason', ['sale', 'penalty', 'adjustment']);
            $table->uuid('invoice_id')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['commercial_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commercial_points');
    }
};
