<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Affectation d'équipiers sans compte + commissions des équipiers :
     * - prestation_team_members.team_member_id (un membre de l'annuaire peut
     *   rejoindre une équipe même sans compte ; user_id devient nullable et
     *   est résolu depuis le compte lié quand il existe) ;
     * - commission_entries.beneficiary_team_member_id ;
     * - commission_payments.beneficiary_team_member_id.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            $this->rebuildTeamMembersSqlite();
        } else {
            Schema::table('prestation_team_members', function (Blueprint $table) {
                $table->foreignUuid('team_member_id')->nullable()->after('user_id')
                    ->constrained('team_members')->nullOnDelete();
            });

            DB::statement('ALTER TABLE prestation_team_members ALTER COLUMN user_id DROP NOT NULL');
        }

        Schema::table('commission_entries', function (Blueprint $table) {
            $table->foreignUuid('beneficiary_team_member_id')->nullable()->after('seller_profile_id')
                ->constrained('team_members')->nullOnDelete();
        });

        Schema::table('commission_payments', function (Blueprint $table) {
            $table->foreignUuid('beneficiary_team_member_id')->nullable()->after('seller_profile_id')
                ->constrained('team_members')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('commission_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('beneficiary_team_member_id');
        });

        Schema::table('commission_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('beneficiary_team_member_id');
        });

        Schema::table('prestation_team_members', function (Blueprint $table) {
            $table->dropConstrainedForeignId('team_member_id');
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE prestation_team_members ALTER COLUMN user_id SET NOT NULL');
        }
    }

    /**
     * SQLite ne sait pas modifier une colonne : reconstruction de la table
     * avec user_id nullable et team_member_id.
     */
    private function rebuildTeamMembersSqlite(): void
    {
        // Les noms d'index sont globaux sur SQLite : libérer le nom avant.
        Schema::table('prestation_team_members', function (Blueprint $table) {
            $table->dropUnique('uq_prestation_team_member');
        });

        Schema::create('prestation_team_members_new', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prestation_id')->constrained('prestations')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('team_member_id')->nullable()->constrained('team_members')->nullOnDelete();
            $table->foreignUuid('client_team_role_id')->nullable()->constrained('client_team_roles')->nullOnDelete();
            $table->boolean('is_lead')->default(false);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->timestamps();

            $table->unique(['prestation_id', 'user_id', 'client_team_role_id'], 'uq_prestation_team_member');
        });

        DB::statement('INSERT INTO prestation_team_members_new (id, prestation_id, user_id, client_team_role_id, is_lead, start_date, end_date, created_at, updated_at) SELECT id, prestation_id, user_id, client_team_role_id, is_lead, start_date, end_date, created_at, updated_at FROM prestation_team_members');

        Schema::drop('prestation_team_members');
        Schema::rename('prestation_team_members_new', 'prestation_team_members');
    }
};
