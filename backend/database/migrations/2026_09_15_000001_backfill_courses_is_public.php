<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('courses')
            ->where('is_public', false)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->update(['is_public' => true]);
    }

    public function down(): void
    {
        // Pas de retour arrière : la visibilité est ensuite contrôlée par l'admin.
    }
};