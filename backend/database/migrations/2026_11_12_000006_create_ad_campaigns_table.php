<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T3.8 — Publicité Pekegno (campagnes locales et nationales).
 *
 * Campagne nationale : répartie mensuellement au prorata du CA de la branche par agence.
 * Campagne locale : imputée directement à l'agence ciblée.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ad_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('branch'); // academy, agency, store, studio
            $table->uuid('country_id');
            $table->boolean('is_national')->default(false);
            $table->uuid('agency_id')->nullable(); // obligatoire si is_national = false
            $table->decimal('budget', 15, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 30)->default('active'); // draft, active, completed, cancelled
            $table->text('description')->nullable();
            $table->uuid('expense_id')->nullable(); // lien éventuel vers une dépense engagée
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('country_id')->references('id')->on('countries')->cascadeOnDelete();
            $table->foreign('agency_id')->references('id')->on('agencies')->nullOnDelete();
            $table->index(['country_id', 'branch']);
            $table->index(['is_national', 'status']);
            $table->index(['start_date', 'end_date']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->uuid('ad_campaign_id')->nullable()->after('service_id');
            $table->foreign('ad_campaign_id')->references('id')->on('ad_campaigns')->nullOnDelete();
            $table->index('ad_campaign_id');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['ad_campaign_id']);
            $table->dropIndex(['ad_campaign_id']);
            $table->dropColumn('ad_campaign_id');
        });

        Schema::dropIfExists('ad_campaigns');
    }
};
