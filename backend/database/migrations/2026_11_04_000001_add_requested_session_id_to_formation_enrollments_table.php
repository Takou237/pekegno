<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une inscription dont la facture attend validation reste « pending » et
 * n'occupe aucune place en session. La session choisie à la saisie est
 * mémorisée ici pour y affecter l'apprenant au moment de la validation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('formation_enrollments', function (Blueprint $table) {
            $table->foreignUuid('requested_session_id')
                ->nullable()
                ->after('invoice_id')
                ->constrained('training_sessions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('formation_enrollments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('requested_session_id');
        });
    }
};
