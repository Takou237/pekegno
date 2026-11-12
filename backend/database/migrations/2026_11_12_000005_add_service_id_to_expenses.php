<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T3.14 — rentabilité d'un événement.
 *
 * Décision client du 12/11/2026 : l'« événement » est le séminaire vendu au
 * catalogue (service coché « Service séminaire (Pass) »), pas une entité
 * séparée. Une dépense peut donc être rattachée à ce service ; la rentabilité
 * se lit comme ventes du séminaire − dépenses rattachées.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->uuid('service_id')->nullable()->after('invoice_id');
            $table->index('service_id');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex(['service_id']);
            $table->dropColumn('service_id');
        });
    }
};
