<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->foreignUuid('package_id')->nullable()->after('formation_id')->constrained('subscription_packs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('package_id');
        });
    }
};
