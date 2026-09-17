<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Renseigne l'agence des journaux d'audit historiques qui pointent vers une
 * facture ou une commande dont l'agence est connue. Corrige l'affichage
 * "Pays / Agence" de la page Audit pour les actions passées.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->backfill('invoice', 'invoices');
        $this->backfill('order', 'orders');
    }

    public function down(): void
    {
        // Backfill de données : pas de rollback.
    }

    private function backfill(string $entityType, string $table): void
    {
        DB::table('activity_logs')
            ->whereNull('agency_id')
            ->where('entity_type', $entityType)
            ->whereNotNull('entity_id')
            ->orderBy('id')
            ->chunkById(200, function ($logs) use ($table) {
                $entityIds = $logs->pluck('entity_id')->unique()->values()->all();

                $agencyByEntity = DB::table($table)
                    ->whereIn('id', $entityIds)
                    ->whereNotNull('agency_id')
                    ->pluck('agency_id', 'id');

                foreach ($logs as $log) {
                    $agencyId = $agencyByEntity[$log->entity_id] ?? null;

                    if ($agencyId) {
                        DB::table('activity_logs')
                            ->where('id', $log->id)
                            ->update(['agency_id' => $agencyId]);
                    }
                }
            });
    }
};
