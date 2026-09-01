<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Montant encaissé au moment de l'inscription à une formation.
 * Il est reporté sur la facture auto-générée (amount_paid de l'invoice).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('formation_enrollments', 'amount_paid')) {
            Schema::table('formation_enrollments', function (Blueprint $table) {
                $table->decimal('amount_paid', 12, 2)->default(0)->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('formation_enrollments', 'amount_paid')) {
            Schema::table('formation_enrollments', function (Blueprint $table) {
                $table->dropColumn('amount_paid');
            });
        }
    }
};