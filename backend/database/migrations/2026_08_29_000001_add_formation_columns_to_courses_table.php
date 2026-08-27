<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->text('objective')->nullable()->after('description');
            $table->text('prerequisites')->nullable()->after('objective');
            $table->string('cover_image', 255)->nullable()->after('prerequisites');
            $table->string('duration_type', 20)->default('limited')->after('duration_hours');
            $table->unsignedSmallInteger('duration_months')->nullable()->after('duration_type');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn([
                'objective',
                'prerequisites',
                'cover_image',
                'duration_type',
                'duration_months',
            ]);
        });
    }
};
