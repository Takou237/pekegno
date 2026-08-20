<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->uuid('organization_id')->nullable()->after('code');
            $table->foreign('organization_id')->references('id')->on('organizations')->nullOnDelete();
            $table->uuid('country_id')->nullable()->after('organization_id');
            $table->foreign('country_id')->references('id')->on('countries')->nullOnDelete();
            $table->uuid('city_id')->nullable()->after('country_id');
            $table->foreign('city_id')->references('id')->on('cities')->nullOnDelete();
            $table->string('type', 20)->default('agency')->after('name');

            $table->index('country_id');
            $table->index('city_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE agencies ADD CONSTRAINT agencies_type_check CHECK (type IN ('agency', 'academy', 'mixed'))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_type_check');
        }

        Schema::table('agencies', function (Blueprint $table) {
            $table->dropIndex(['country_id']);
            $table->dropIndex(['city_id']);
            $table->dropForeign(['organization_id']);
            $table->dropForeign(['country_id']);
            $table->dropForeign(['city_id']);
            $table->dropColumn(['organization_id', 'country_id', 'city_id', 'type']);
        });
    }
};