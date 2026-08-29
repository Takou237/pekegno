<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            $table->foreignUuid('beneficiary_seller_profile_id')->nullable()->after('beneficiary_commercial_id')
                ->constrained('seller_profiles')->nullOnDelete();
            $table->foreignUuid('course_id')->nullable()->after('service_id')
                ->constrained('courses')->nullOnDelete()
                ->comment('Formation ciblée (NULL = toute formation/service)');
        });

        Schema::table('commission_rules', function (Blueprint $table) {
            $table->index('beneficiary_seller_profile_id');
            $table->index('course_id');
        });
    }

    public function down(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            $table->dropIndex(['beneficiary_seller_profile_id']);
            $table->dropIndex(['course_id']);
            $table->dropConstrainedForeignId('beneficiary_seller_profile_id');
            $table->dropConstrainedForeignId('course_id');
        });
    }
};