<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('seller_profile_id')->nullable()->after('beneficiary_commercial_id')->constrained('seller_profiles')->nullOnDelete();
            $table->string('category', 20)->default('service')->after('amount')
                ->comment('training | service');
            $table->uuid('product_id')->nullable()->after('category')
                ->comment('course_id or service_id');
            $table->string('product_type', 20)->nullable()->after('product_id')
                ->comment('course | service');
        });
    }

    public function down(): void
    {
        Schema::table('commission_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('seller_profile_id');
            $table->dropColumn(['category', 'product_id', 'product_type']);
        });
    }
};
