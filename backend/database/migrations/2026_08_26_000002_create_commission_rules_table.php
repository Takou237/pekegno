<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('rule_group_id'); // identité de la règle à travers ses versions
            $table->integer('version')->default(1);
            $table->string('name', 150);
            $table->foreignUuid('beneficiary_commercial_id')->nullable()->constrained('commercials')->nullOnDelete();
            $table->foreignUuid('scope_country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignUuid('scope_agency_id')->nullable()->constrained('agencies')->nullOnDelete();
            $table->foreignUuid('scope_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUuid('service_id')->nullable()->constrained('services')->nullOnDelete(); // NULL = tout produit/service
            $table->string('trigger_event', 20)->checkIn(['on_sale', 'on_payment', 'on_full_payment']);
            $table->string('formula_type', 10)->checkIn(['percent', 'fixed', 'tiered']);
            $table->decimal('percent_value', 5, 2)->nullable();
            $table->decimal('fixed_amount', 14, 2)->nullable();
            $table->jsonb('tiers_json')->nullable(); // [{up_to, value, mode}]
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignUuid('created_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['rule_group_id', 'version']);
            $table->index('scope_agency_id');
            $table->index('scope_department_id');
            $table->index('service_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_rules');
    }
};