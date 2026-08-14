<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE commercial_points DROP CONSTRAINT IF EXISTS commercial_points_reason_check');
        DB::statement("ALTER TABLE commercial_points ADD CONSTRAINT commercial_points_reason_check CHECK (reason IN ('sale', 'penalty', 'adjustment', 'prospect', 'conversion'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE commercial_points DROP CONSTRAINT IF EXISTS commercial_points_reason_check');
        DB::statement("ALTER TABLE commercial_points ADD CONSTRAINT commercial_points_reason_check CHECK (reason IN ('sale', 'penalty', 'adjustment'))");
    }
};
