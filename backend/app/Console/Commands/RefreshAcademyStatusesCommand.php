<?php

namespace App\Console\Commands;

use App\Models\FormationEnrollment;
use App\Models\SessionParticipant;
use App\Models\TrainingSession;
use Illuminate\Console\Command;

/**
 * Académie : enregistre en base les statuts liés aux dates (B20).
 *
 * - Session : planifiée avant son début, en cours pendant, terminée après sa
 *   date de fin (une session annulée ou terminée à la main ne bouge pas).
 * - Inscription : « terminée » quand toutes ses sessions sont terminées.
 *   Une inscription en attente de validation ou annulée ne bouge pas.
 *
 * L'affichage calcule déjà le statut des sessions en direct ; la commande
 * aligne la base (filtres SQL, rapports, inscriptions). Rejouable.
 */
class RefreshAcademyStatusesCommand extends Command
{
    protected $signature = 'academy:refresh-statuses';

    protected $description = 'Académie : statut des sessions selon leurs dates, inscriptions terminées en fin de formation';

    public function handle(): int
    {
        $sessions = 0;
        TrainingSession::query()
            ->whereNotIn('status', [TrainingSession::STATUS_CANCELLED, TrainingSession::STATUS_COMPLETED])
            ->chunkById(200, function ($chunk) use (&$sessions) {
                foreach ($chunk as $session) {
                    $effective = $session->status; // accesseur : calculé depuis les dates
                    if ($effective !== $session->getRawOriginal('status')) {
                        TrainingSession::whereKey($session->id)->update(['status' => $effective]);
                        $sessions++;
                    }
                }
            });

        // Inscriptions actives dont toutes les sessions (non annulées) sont terminées.
        $enrollments = 0;
        FormationEnrollment::query()
            ->where('status', FormationEnrollment::STATUS_ENROLLED)
            ->whereHas('sessionParticipants', fn ($q) => $q->where('status', '!=', 'cancelled'))
            ->with(['sessionParticipants' => fn ($q) => $q->where('status', '!=', 'cancelled')->with('session')])
            ->chunkById(200, function ($chunk) use (&$enrollments) {
                foreach ($chunk as $enrollment) {
                    $allDone = $enrollment->sessionParticipants->every(
                        fn (SessionParticipant $p) => $p->session && $p->session->status === TrainingSession::STATUS_COMPLETED
                    );
                    if ($allDone) {
                        $enrollment->update(['status' => FormationEnrollment::STATUS_COMPLETED]);
                        $enrollments++;
                    }
                }
            });

        $this->info("Sessions mises à jour : {$sessions} · Inscriptions terminées : {$enrollments}");

        return self::SUCCESS;
    }
}
