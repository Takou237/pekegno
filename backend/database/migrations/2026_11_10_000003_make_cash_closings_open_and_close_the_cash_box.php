<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Clôture = fin de la journée de travail de la caisse, décidée par la
     * caissière. La caisse reste fermée (rien n'y entre ni n'en sort, les
     * paiements de l'agence attendent) jusqu'à sa réouverture, qui ouvre la
     * journée suivante avec pour solde initial le solde final de la clôture.
     *
     * Une journée n'est donc plus un jour du calendrier : plusieurs clôtures
     * peuvent tomber le même jour (unicité caisse + date retirée).
     */
    public function up(): void
    {
        Schema::table('cash_closings', function (Blueprint $table) {
            $table->timestamp('opened_at')->nullable()->after('closing_date');
            $table->timestamp('closed_at')->nullable()->after('opened_at');
            $table->timestamp('reopened_at')->nullable()->after('closed_at');
            $table->foreignUuid('reopened_by')->nullable()->after('reopened_at')->constrained('users')->nullOnDelete();
            $table->index(['treasury_account_id', 'reopened_at']);
        });

        // Anciennes clôtures (« relevé du jour ») : considérées comme rouvertes,
        // aucune caisse ne se retrouve fermée par la migration.
        DB::table('cash_closings')->whereNull('closed_at')->update([
            'closed_at' => DB::raw('created_at'),
            'reopened_at' => DB::raw('created_at'),
        ]);

        Schema::table('cash_closings', function (Blueprint $table) {
            $table->dropUnique(['treasury_account_id', 'closing_date']);
        });
    }

    public function down(): void
    {
        Schema::table('cash_closings', function (Blueprint $table) {
            $table->unique(['treasury_account_id', 'closing_date']);
            $table->dropIndex(['treasury_account_id', 'reopened_at']);
            $table->dropConstrainedForeignId('reopened_by');
            $table->dropColumn(['opened_at', 'closed_at', 'reopened_at']);
        });
    }
};
