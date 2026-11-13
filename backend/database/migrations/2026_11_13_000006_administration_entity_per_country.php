<?php

use App\Models\Country;
use App\Services\TreasuryAccountProvisioner;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cahier §2 « L'administration » : chaque pays a deux corps — les agences,
 * qui vendent, et l'Administration, qui reçoit l'argent des agences et paie
 * les dépenses du groupe (frais d'administration, publicité Pekegno, stock de
 * livres et de Matootoo).
 *
 * L'Administration d'un pays n'est PAS une agence (le « type d'agence
 * administration » du 12/11 est retiré) : ses dépenses, ses écritures et ses
 * caisses portent le pays (country_id) sans agence.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignUuid('country_id')->nullable()->after('agency_id')->constrained('countries')->nullOnDelete();
            $table->uuid('agency_id')->nullable()->change();
        });
        Schema::table('accounting_transactions', function (Blueprint $table) {
            $table->foreignUuid('country_id')->nullable()->after('agency_id')->constrained('countries')->nullOnDelete();
        });
        Schema::table('treasury_accounts', function (Blueprint $table) {
            $table->foreignUuid('country_id')->nullable()->after('agency_id')->constrained('countries')->nullOnDelete();
        });

        // Retrait du type d'agence « administration » (incompris le 12/11).
        if (DB::getDriverName() === 'pgsql' && ! DB::table('agencies')->where('type', 'administration')->exists()) {
            DB::statement('ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_type_check');
            DB::statement("ALTER TABLE agencies ADD CONSTRAINT agencies_type_check CHECK (type IN ('agency', 'academy', 'mixed'))");
        }

        // Caisses de l'Administration de chaque pays qui a des agences.
        $provisioner = app(TreasuryAccountProvisioner::class);
        Country::query()->whereIn('id', DB::table('agencies')->whereNull('deleted_at')->select('country_id'))->get()
            ->each(fn (Country $country) => $provisioner->ensureForAdministration($country));
    }

    public function down(): void
    {
        Schema::table('treasury_accounts', fn (Blueprint $table) => $table->dropConstrainedForeignId('country_id'));
        Schema::table('accounting_transactions', fn (Blueprint $table) => $table->dropConstrainedForeignId('country_id'));
        Schema::table('expenses', fn (Blueprint $table) => $table->dropConstrainedForeignId('country_id'));
    }
};
