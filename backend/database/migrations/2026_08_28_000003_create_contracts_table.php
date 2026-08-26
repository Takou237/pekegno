<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('number', 30)->unique(); // CTR-00001
            $table->foreignUuid('client_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignUuid('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUuid('pack_id')->nullable()->constrained('subscription_packs')->nullOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('billing_cycle', 20)->default('monthly')
                ->checkIn(['one_shot', 'monthly', 'quarterly', 'yearly']);
            $table->decimal('amount', 15, 2);
            $table->string('status', 20)->default('active')
                ->checkIn(['active', 'due_soon', 'expired', 'suspended', 'terminated']);
            $table->boolean('auto_renew')->default(false);
            $table->unsignedInteger('renewal_count')->default(0);
            $table->uuid('parent_contract_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('terminated_at')->nullable();
            $table->string('terminated_reason', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('client_id');
            $table->index(['status', 'end_date']);
        });

        Schema::table('contracts', function (Blueprint $table) {
            $table->foreign('parent_contract_id')->references('id')->on('contracts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
