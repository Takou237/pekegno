<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX uq_agency_chief ON user_assignments (agency_id) WHERE is_primary = true');
        DB::statement('CREATE UNIQUE INDEX uq_department_chief ON user_assignments (department_id) WHERE is_department_chief = true AND department_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS uq_agency_chief');
        DB::statement('DROP INDEX IF EXISTS uq_department_chief');
    }
};
