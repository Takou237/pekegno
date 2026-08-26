<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_services', function (Blueprint $table) {
            $table->foreignUuid('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignUuid('service_id')->constrained('services')->restrictOnDelete();
            $table->decimal('price', 15, 2)->nullable();

            $table->primary(['contract_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_services');
    }
};
