<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('modules');
        Schema::dropIfExists('formations');
    }

    public function down(): void
    {
        // Les tables formations/modules ont été supprimées du projet.
        // La restauration nécessiterait de recréer les migrations d'origine.
    }
};
