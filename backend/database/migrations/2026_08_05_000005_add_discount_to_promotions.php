<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->enum('type', ['amount', 'percent'])->default('amount')->after('service_id');
            $table->decimal('discount_percent', 5, 2)->nullable()->after('promo_price');
            $table->decimal('promo_price', 12, 2)->nullable()->change();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(<<<'SQL'
                ALTER TABLE promotions
                    ADD CONSTRAINT promotions_type_coherence CHECK (
                        (type = 'amount' AND promo_price IS NOT NULL AND discount_percent IS NULL)
                        OR (type = 'percent' AND discount_percent IS NOT NULL
                            AND discount_percent > 0 AND discount_percent <= 100
                            AND promo_price IS NULL)
                    )
            SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE promotions DROP CONSTRAINT promotions_type_coherence');
        }

        Schema::table('promotions', function (Blueprint $table) {
            $table->decimal('promo_price', 12, 2)->change();
            $table->dropColumn(['type', 'discount_percent']);
        });
    }
};
