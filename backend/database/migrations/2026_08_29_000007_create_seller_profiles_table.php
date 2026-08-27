<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->string('kind', 20)->default('commercial')
                ->checkIn(['trainer', 'commercial', 'employee']);
            $table->string('commission_type', 20)->default('none')
                ->checkIn(['percent', 'fixed', 'none']);
            $table->decimal('commission_value', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'agency_id']);
            $table->index('kind');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_profiles');
    }
};
