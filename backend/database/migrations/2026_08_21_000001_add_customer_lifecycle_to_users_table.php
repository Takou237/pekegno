<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->after('client_category_id');
            $table->uuid('registered_agency_id')->nullable()->after('city_id');
            $table->foreign('registered_agency_id')->references('id')->on('agencies')->nullOnDelete();
            $table->uuid('commercial_user_id')->nullable()->after('registered_agency_id');
            $table->foreign('commercial_user_id')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('registered_at')->nullable()->after('commercial_user_id');

            $table->index('status');
            $table->index('registered_agency_id');
            $table->index('commercial_user_id');
            $table->index('registered_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['registered_agency_id']);
            $table->dropIndex(['commercial_user_id']);
            $table->dropIndex(['registered_at']);
            $table->dropForeign(['registered_agency_id']);
            $table->dropForeign(['commercial_user_id']);
            $table->dropColumn(['status', 'registered_agency_id', 'commercial_user_id', 'registered_at']);
        });
    }
};