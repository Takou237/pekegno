<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Lignes de métier d'une agence.
     *
     * Une agence physique (Douala, Yaoundé…) n'est ni « agency » ni « academy » :
     * elle peut exercer les deux activités. `agency` = prestations de services
     * marketing/publicité ; `academy` = formations. `type` sur `agencies` reste
     * une valeur dérivée de compatibilité.
     */
    public function up(): void
    {
        Schema::create('agency_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->string('type', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['agency_id', 'type']);
            $table->index(['agency_id', 'is_active']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE agency_activities ADD CONSTRAINT agency_activities_type_check CHECK (type IN ('agency', 'academy'))");
        }

        // Backfill : chaque agence existante reçoit les lignes de métier correspondant à son type historique.
        $now = now()->toDateTimeString();
        DB::table('agencies')->orderBy('id')->chunkById(100, function ($agencies) use ($now) {
            foreach ($agencies as $agency) {
                $types = match ($agency->type) {
                    'academy' => ['academy'],
                    'mixed' => ['agency', 'academy'],
                    default => ['agency'],
                };

                foreach ($types as $type) {
                    DB::table('agency_activities')->insert([
                        'id' => (string) Str::uuid(),
                        'agency_id' => $agency->id,
                        'type' => $type,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agency_activities');
    }
};
