<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('commission_rule_id')->nullable()->change();
            $table->jsonb('rule_snapshot')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('commission_rule_id')->nullable(false)->change();
            $table->jsonb('rule_snapshot')->nullable(false)->change();
        });
    }
};