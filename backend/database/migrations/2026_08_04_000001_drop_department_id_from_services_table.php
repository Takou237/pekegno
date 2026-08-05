<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_agency_department_xor');
        }

        if (Schema::hasColumn('services', 'department_id')) {
            Schema::table('services', function ($table) {
                $table->dropForeign(['department_id']);
                $table->dropColumn('department_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('services', 'department_id')) {
            Schema::table('services', function ($table) {
                $table->foreignUuid('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'ALTER TABLE services ADD CONSTRAINT services_agency_department_xor
                 CHECK ((agency_id IS NOT NULL) != (department_id IS NOT NULL))'
            );
        }
    }
};
