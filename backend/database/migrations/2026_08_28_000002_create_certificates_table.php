<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('enrollment_id')->constrained('enrollments')->cascadeOnDelete()->unique();
            $table->string('number', 30)->unique(); // CERT-00001
            $table->date('issued_on');
            $table->string('mention', 100)->nullable();
            $table->string('status', 10)->default('issued')
                ->checkIn(['issued', 'revoked']);
            $table->string('revoked_reason', 255)->nullable();
            $table->string('file_path', 255)->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
