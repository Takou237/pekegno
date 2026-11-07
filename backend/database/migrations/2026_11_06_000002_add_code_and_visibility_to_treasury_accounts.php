<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Rôles autorisés à voir les caisses Mobile Money / Banque (sécurité §16). */
    private const RESTRICTED_ROLES = ['super-admin', 'direction-generale', 'comptable'];

    public function up(): void
    {
        Schema::table('treasury_accounts', function (Blueprint $table) {
            $table->string('code', 5)->nullable()->after('name');
            $table->json('visible_roles')->nullable()->after('is_active');
        });

        // Backfill des comptes existants : un code canonique par caisse, suffixé
        // si l'agence possède plusieurs comptes du même type.
        $used = [];
        $accounts = DB::table('treasury_accounts')->orderBy('created_at')->get();

        foreach ($accounts as $account) {
            $base = match (true) {
                $account->type === 'cash' => 'C',
                $account->type === 'bank' => 'B',
                $account->provider === 'orange_money' => 'O',
                $account->provider === 'mtn_momo' => 'M',
                $account->provider === 'wave' => 'W',
                $account->provider === 'moov_money' => 'V',
                default => 'X',
            };

            $agencyKey = $account->agency_id ?? 'global';
            $code = $base;
            $suffix = 2;
            while (isset($used[$agencyKey][$code])) {
                $code = $base.$suffix;
                $suffix++;
            }
            $used[$agencyKey][$code] = true;

            DB::table('treasury_accounts')->where('id', $account->id)->update([
                'code' => $code,
                'visible_roles' => $account->type === 'cash'
                    ? null
                    : json_encode(self::RESTRICTED_ROLES),
            ]);
        }

        Schema::table('treasury_accounts', function (Blueprint $table) {
            $table->unique(['agency_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::table('treasury_accounts', function (Blueprint $table) {
            $table->dropUnique(['agency_id', 'code']);
            $table->dropColumn(['code', 'visible_roles']);
        });
    }
};
