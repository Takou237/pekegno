<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Les packages sont publics par défaut : dès sa création, un package
     * apparaît sur le site public (aucune case à cocher requise). Le flag
     * reste modifiable pour dépublier un package si besoin.
     */
    public function up(): void
    {
        Schema::table('subscription_packs', function (Blueprint $table) {
            $table->boolean('is_public')->default(true)->change();
        });

        DB::table('subscription_packs')->update(['is_public' => true]);
    }

    public function down(): void
    {
        Schema::table('subscription_packs', function (Blueprint $table) {
            $table->boolean('is_public')->default(false)->change();
        });
    }
};
