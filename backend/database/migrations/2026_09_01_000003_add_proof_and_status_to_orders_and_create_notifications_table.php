<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('proof_path')->nullable()->after('notes');
            $table->string('proof_url')->nullable()->after('proof_path');
            $table->timestamp('submitted_at')->nullable()->after('proof_url');
            $table->foreignUuid('validated_by')->nullable()->after('submitted_at')->constrained('users')->nullOnDelete();
            $table->text('validation_note')->nullable()->after('validated_by');
            $table->timestamp('validated_at')->nullable()->after('validation_note');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('type')->default('info');
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('link')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['validated_by']);
            $table->dropColumn([
                'proof_path',
                'proof_url',
                'submitted_at',
                'validated_by',
                'validation_note',
                'validated_at',
            ]);
        });
    }
};
