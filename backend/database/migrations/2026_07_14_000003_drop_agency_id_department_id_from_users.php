<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['agency_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['agency_id', 'department_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignUuid('agency_id')->nullable()->after('role_id')->constrained('agencies')->nullOnDelete();
            $table->foreignUuid('department_id')->nullable()->after('agency_id')->constrained('departments')->nullOnDelete();
        });
    }
};
