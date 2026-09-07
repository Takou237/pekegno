<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_observations', function (Blueprint $table) {
            $table->foreignUuid('course_module_id')->nullable()->constrained('course_modules')->cascadeOnDelete()->after('session_id');
            $table->foreignUuid('author_user_id')->nullable()->constrained('users')->nullOnDelete()->after('course_module_id');
            $table->boolean('visible_to_client')->default(true)->after('author_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('learner_observations', function (Blueprint $table) {
            $table->dropForeign(['course_module_id']);
            $table->dropForeign(['author_user_id']);
            $table->dropColumn(['course_module_id', 'author_user_id', 'visible_to_client']);
        });
    }
};
