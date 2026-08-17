<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commercials', function (Blueprint $table) {
            $table->enum('kind', ['commercial', 'employe'])->default('commercial')->after('agency_id');
        });
    }

    public function down(): void
    {
        Schema::table('commercials', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
