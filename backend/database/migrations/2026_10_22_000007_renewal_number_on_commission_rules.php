<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Renouvellement : la règle vise le N-ième renouvellement d'un contrat
 * (1 = premier renouvellement, 3 = troisième… ; vide = chaque renouvellement),
 * éventuellement seulement s'il est payé « à date » (avant la fin de la période
 * précédente).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            $table->renameColumn('renewal_month', 'renewal_number');
        });

        Schema::table('commission_rules', function (Blueprint $table) {
            $table->boolean('renewal_on_time')->default(false)->after('renewal_number');
        });
    }

    public function down(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            $table->dropColumn('renewal_on_time');
        });

        Schema::table('commission_rules', function (Blueprint $table) {
            $table->renameColumn('renewal_number', 'renewal_month');
        });
    }
};
