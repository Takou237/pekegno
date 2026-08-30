<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opportunities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 200);
            $table->foreignUuid('prospect_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignUuid('client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('commercial_id')->constrained()->cascadeOnDelete();
            $table->string('stage', 20)->default('new')->checkIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
            $table->decimal('expected_amount', 15, 2)->nullable();
            $table->date('expected_close_date')->nullable();
            $table->timestamp('won_at')->nullable();
            $table->timestamp('lost_at')->nullable();
            $table->text('loss_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('stage');
            $table->index('commercial_id');
            $table->index('agency_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opportunities');
    }
};
