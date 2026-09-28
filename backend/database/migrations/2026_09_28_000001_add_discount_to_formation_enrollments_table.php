<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Une inscription peut ouvrir droit à une remise accordée par le vendeur
 * (commercial, caissier, guichet) : pourcentage ou montant fixe.
 *
 * On mémorise la saisie (type + valeur) pour la tracer ; le montant résolu
 * est reporté sur la facture générée (invoices.discount, comme sur une
 * facture saisie au guichet).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('formation_enrollments', function (Blueprint $table) {
            $table->enum('discount_type', ['amount', 'percent'])->nullable()->after('seller_trainer_id');
            $table->decimal('discount_value', 12, 2)->nullable()->after('discount_type');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(<<<'SQL'
                ALTER TABLE formation_enrollments
                    ADD CONSTRAINT formation_enrollments_discount_coherence CHECK (
                        (discount_type IS NULL AND discount_value IS NULL)
                        OR (discount_type = 'amount' AND discount_value IS NOT NULL AND discount_value >= 0)
                        OR (discount_type = 'percent' AND discount_value IS NOT NULL
                            AND discount_value > 0 AND discount_value <= 100)
                    )
            SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE formation_enrollments DROP CONSTRAINT formation_enrollments_discount_coherence');
        }

        Schema::table('formation_enrollments', function (Blueprint $table) {
            $table->dropColumn(['discount_type', 'discount_value']);
        });
    }
};
