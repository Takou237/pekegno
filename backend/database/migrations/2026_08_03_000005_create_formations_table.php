<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('formations', function (Blueprint $table) {
            $table->foreignUuid('id')->primary()->constrained('services')->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('duration', 50)->nullable();
            $table->text('conditions')->nullable();
            $table->decimal('deposit_amount', 12, 2)->nullable();
            $table->integer('installments_count')->nullable();
            $table->boolean('online_payment')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('formations');
    }
};
