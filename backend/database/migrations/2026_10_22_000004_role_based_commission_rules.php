<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Règles de commission par rôle (onglet « Commissions » des réglages).
 *
 * Une règle décrit QUOI rémunérer (assiette : vente, renouvellement, upgrade,
 * CA mensuel par paliers, croissance vs N-1, prime manuelle), SUR QUOI (produit,
 * prestation, formation, package, catégorie) et COMBIEN (%, montant fixe,
 * paliers). Elle est ensuite attribuée à un ou plusieurs rôles : chaque
 * utilisateur de ces rôles impliqué dans l'opération en bénéficie.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_rules', function (Blueprint $table) {
            // sale | renewal | upgrade | monthly_revenue | growth | manual
            $table->string('basis', 30)->default('sale')->after('name');
            $table->text('description')->nullable()->after('basis');
            $table->foreignUuid('product_id')->nullable()->after('package_id')->constrained('products')->nullOnDelete();
            $table->foreignUuid('category_id')->nullable()->after('product_id')->constrained('categories')->nullOnDelete();
            // Renouvellement : mois du contrat concerné (3 = 3e mois) ; null = chaque renouvellement.
            $table->unsignedSmallInteger('renewal_month')->nullable();
            // CA mensuel / croissance : CA du bénéficiaire (own) ou de son agence (agency).
            $table->string('revenue_scope', 20)->default('own');
            // Condition de recouvrement (en %) pour les bonus de palier, et période de référence.
            $table->decimal('min_recovery_rate', 5, 2)->nullable();
            $table->string('recovery_period', 30)->default('previous_month');
            // Croissance : objectif (×N par rapport au même mois N-1) et plafond du pourcentage.
            $table->decimal('growth_multiplier', 6, 2)->nullable();
            $table->decimal('max_percent', 5, 2)->nullable();
            // Prime manuelle : fourchette autorisée (ex. témoignage 10 000 à 25 000).
            $table->decimal('bonus_min', 14, 2)->nullable();
            $table->decimal('bonus_max', 14, 2)->nullable();
        });

        // Rattachement règle ↔ rôle par groupe de règle : l'attribution survit
        // aux nouvelles versions de la règle.
        Schema::create('commission_rule_role', function (Blueprint $table) {
            $table->uuid('rule_group_id');
            $table->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['rule_group_id', 'role_id']);
            $table->index('role_id');
        });

        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('beneficiary_user_id')->nullable()->after('beneficiary_team_member_id')->constrained('users')->nullOnDelete();
            // Règles périodiques (CA mensuel, croissance) : mois concerné « YYYY-MM ».
            $table->string('period', 7)->nullable()->after('beneficiary_user_id');
            $table->index(['commission_rule_id', 'beneficiary_user_id', 'period']);
        });

        Schema::table('commission_payments', function (Blueprint $table) {
            $table->foreignUuid('beneficiary_user_id')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('beneficiary_user_id');
        });

        Schema::table('commission_entries', function (Blueprint $table) {
            $table->dropIndex(['commission_rule_id', 'beneficiary_user_id', 'period']);
            $table->dropConstrainedForeignId('beneficiary_user_id');
            $table->dropColumn('period');
        });

        Schema::dropIfExists('commission_rule_role');

        Schema::table('commission_rules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn([
                'basis', 'description', 'renewal_month', 'revenue_scope', 'min_recovery_rate',
                'recovery_period', 'growth_multiplier', 'max_percent', 'bonus_min', 'bonus_max',
            ]);
        });
    }
};
