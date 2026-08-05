<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('client_number', 20)->nullable()->unique()->after('phone');
            $table->string('city', 100)->nullable()->after('client_number');
            $table->string('country', 100)->nullable()->after('city');
            $table->string('address', 255)->nullable()->after('country');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['client_number']);
            $table->dropColumn(['client_number', 'city', 'country', 'address']);
        });
    }
};
