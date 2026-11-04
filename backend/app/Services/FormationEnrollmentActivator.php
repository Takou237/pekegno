<?php

namespace App\Services;

use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\SessionParticipant;
use App\Models\TrainingSession;

/**
 * Cycle de vie « inscription ↔ facture » : tant que la facture d'une inscription
 * attend validation, l'apprenant n'est pas inscrit (statut pending, aucune place
 * en session). Il le devient lorsque la facture est validée.
 */
class FormationEnrollmentActivator
{
    /**
     * Statut initial d'une inscription selon sa facture : en attente tant que la
     * facture n'est pas validée, inscrit sinon (facture validée ou formation gratuite).
     */
    public function initialStatusFor(?Invoice $invoice): string
    {
        return $invoice && $invoice->validation_status === Invoice::VALIDATION_PENDING
            ? FormationEnrollment::STATUS_PENDING
            : FormationEnrollment::STATUS_ENROLLED;
    }

    /**
     * Facture validée : les inscriptions en attente qui lui sont rattachées
     * deviennent effectives et l'apprenant est affecté à sa session.
     */
    public function activateForInvoice(Invoice $invoice): void
    {
        $enrollments = FormationEnrollment::where('invoice_id', $invoice->id)
            ->where('status', FormationEnrollment::STATUS_PENDING)
            ->get();

        foreach ($enrollments as $enrollment) {
            $requestedSessionId = $enrollment->requested_session_id;

            $enrollment->update([
                'status' => FormationEnrollment::STATUS_ENROLLED,
                'enrolled_at' => now(),
                'requested_session_id' => null,
            ]);

            $this->assignToAvailableSessions($enrollment, $requestedSessionId);
        }
    }

    /**
     * Affecte une inscription aux sessions encore ouvertes de sa formation.
     *
     * Une session explicitement choisie est retenue si elle a de la place. Sans
     * choix, on n'affecte que si le choix est évident : une seule session
     * disponible. En présence de plusieurs, inscrire l'apprenant à toutes serait
     * arbitraire — d'autant qu'une formation en ligne n'a pas forcément de
     * session du tout (elle reste donc inscriptible sans).
     */
    public function assignToAvailableSessions(FormationEnrollment $enrollment, ?string $trainingSessionId = null): void
    {
        $query = TrainingSession::where('course_id', $enrollment->course_id)
            ->where(fn ($q) => $q->whereNull('end_at')->orWhere('end_at', '>=', now()));

        if ($trainingSessionId) {
            $query->whereKey($trainingSessionId);
        }

        $sessions = $query->get(['id', 'max_capacity']);

        if (! $trainingSessionId && $sessions->count() > 1) {
            return;
        }

        foreach ($sessions as $session) {
            $count = SessionParticipant::where('training_session_id', $session->id)
                ->where('status', 'enrolled')
                ->count();

            if ($session->max_capacity !== null && $count >= $session->max_capacity) {
                continue;
            }

            SessionParticipant::updateOrCreate(
                [
                    'training_session_id' => $session->id,
                    'formation_enrollment_id' => $enrollment->id,
                ],
                ['status' => 'enrolled']
            );
        }
    }
}
