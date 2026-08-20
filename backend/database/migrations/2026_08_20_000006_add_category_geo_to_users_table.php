<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('client_category_id')->nullable()->after('role_id');
            $table->foreign('client_category_id')->references('id')->on('client_categories')->nullOnDelete();
            $table->uuid('country_id')->nullable()->after('country');
            $table->foreign('country_id')->references('id')->on('countries')->nullOnDelete();
            $table->uuid('city_id')->nullable()->after('country_id');
            $table->foreign('city_id')->references('id')->on('cities')->nullOnDelete();

            $table->index('client_category_id');
            $table->index('country_id');
            $table->index('city_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['client_category_id']);
            $table->dropIndex(['country_id']);
            $table->dropIndex(['city_id']);
            $table->dropForeign(['client_category_id']);
            $table->dropForeign(['country_id']);
            $table->dropForeign(['city_id']);
            $table->dropColumn(['client_category_id', 'country_id', 'city_id']);
        });
    }
};