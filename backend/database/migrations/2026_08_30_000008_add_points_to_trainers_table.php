<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les formateurs gagnent aussi des points PEKEGNO (mêmes règles que les
 * commerciaux : « Points par vente » d'une facture payée intégralement).
 * Chaque attribution est tracée dans trainer_points (idempotent via
 * invoices.points_awarded), le solde est stocké sur trainers.points_balance.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trainers', function (Blueprint $table) {
            $table->integer('points_balance')->default(0)->after('bio');
        });

        Schema::create('trainer_points', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('trainer_id')->constrained()->cascadeOnDelete();
            $table->integer('points');
            $table->string('reason', 50)->default('sale');
            $table->uuid('invoice_id')->nullable();
            $table->foreign('invoice_id')->references('id')->on('invoices')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['trainer_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trainer_points');

        Schema::table('trainers', function (Blueprint $table) {
            $table->dropColumn('points_balance');
        });
    }
};