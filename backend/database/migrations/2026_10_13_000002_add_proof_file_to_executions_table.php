<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prestation_action_executions', function (Blueprint $table) {
            $table->string('proof_file', 2048)->nullable()->after('proof_url');
        });
        Schema::table('prestation_action_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('prestation_action_logs', 'proof_file')) {
                $table->string('proof_file', 2048)->nullable()->after('proof_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('prestation_action_executions', function (Blueprint $table) {
            $table->dropColumn('proof_file');
        });
        Schema::table('prestation_action_logs', function (Blueprint $table) {
            if (Schema::hasColumn('prestation_action_logs', 'proof_file')) {
                $table->dropColumn('proof_file');
            }
        });
    }
};
