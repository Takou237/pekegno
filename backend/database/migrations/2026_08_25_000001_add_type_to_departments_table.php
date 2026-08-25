<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->string('type', 20)->default('agency')->after('name');
        });

        DB::statement("ALTER TABLE departments ADD CONSTRAINT departments_type_check
            CHECK (type IN ('academy','agency','store','studio'))");

        // Backfill : departments heritant du type de leur agence
        DB::statement("
            UPDATE departments d
            SET type = CASE
                WHEN a.type = 'academy' THEN 'academy'
                ELSE 'agency'
            END
            FROM agencies a
            WHERE d.agency_id = a.id
        ");
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropForeign(['agency_id']);
            $table->dropColumn('type');
        });
    }
};
