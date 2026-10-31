<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_sessions', function (Blueprint $table) {
            $table->string('duration_type', 20)->default('unlimited')->after('price');
        });

        // Une session existante avec une date de fin est « limitée ».
        DB::table('training_sessions')->whereNotNull('end_at')->update(['duration_type' => 'limited']);
    }

    public function down(): void
    {
        Schema::table('training_sessions', function (Blueprint $table) {
            $table->dropColumn('duration_type');
        });
    }
};
