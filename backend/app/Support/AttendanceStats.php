<?php

namespace App\Support;

use App\Models\Attendance;
use App\Models\TrainingSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Taux de présence (B22) : présents / attendus, sur les séances PASSÉES.
 *
 * Règle unique, partagée par les trois écrans (Rapport académie, Sessions/
 * Planning, Espace formateur) :
 *
 *   attendus = Σ (apprenants attendus de la séance) sur les séances passées
 *   présents = Σ (apprenants de la séance marqués « présent » au moins une fois)
 *
 * Ne comptent que les séances réellement passées (fin de séance, sinon début,
 * avant maintenant), ni annulées ni supprimées : une séance à venir n'a pas
 * encore d'attendus, et une séance annulée n'en a jamais eu.
 *
 * La présence est enregistrée par (séance, module) : un apprenant peut avoir
 * plusieurs lignes « présent » sur une même séance. Il est donc compté UNE fois
 * par séance, ce qui garde le taux borné à 100 %.
 */
final class AttendanceStats
{
    /**
     * @param  Collection<int, TrainingSession>  $sessions  séances du périmètre
     * @param  callable(TrainingSession): array<int, string>  $expectedLearners  apprenants attendus d'une séance
     * @return array{expected: int, present: int, marked: int, rate: float}
     */
    public static function compute(Collection $sessions, callable $expectedLearners, ?Carbon $now = null): array
    {
        $now ??= now();

        $past = $sessions
            ->filter(function (TrainingSession $session) use ($now) {
                if ($session->status === 'cancelled' || $session->trashed()) {
                    return false;
                }

                $reference = $session->end_at ?? $session->start_at;

                return $reference !== null && $reference->lt($now);
            })
            ->values();

        $rowsBySession = $past->isEmpty()
            ? collect()
            : Attendance::query()
                ->whereIn('training_session_id', $past->pluck('id'))
                ->get(['training_session_id', 'learner_user_id', 'status'])
                ->groupBy('training_session_id');

        $expected = 0;
        $present = 0;
        $marked = 0;

        foreach ($past as $session) {
            $learners = array_values(array_unique(array_filter($expectedLearners($session))));
            $expected += count($learners);

            $sessionRows = $rowsBySession->get($session->id, collect());

            // Pointages effectués : apprenants ayant une ligne (présent ou absent).
            $marked += $sessionRows->pluck('learner_user_id')->filter()->unique()->count();

            // Présents : apprenants attendus marqués présents au moins une fois.
            $present += $sessionRows
                ->filter(fn ($row) => $row->status === Attendance::STATUS_PRESENT
                    && $row->learner_user_id !== null
                    && in_array($row->learner_user_id, $learners, true))
                ->pluck('learner_user_id')
                ->unique()
                ->count();
        }

        return [
            'expected' => $expected,
            'present' => $present,
            'marked' => $marked,
            // Aucun attendu (pas de séance passée ou aucun inscrit) : 0 %, jamais
            // un taux inventé. Le taux de groupe, lui, reste null pour dire « pas
            // de donnée » plutôt que « 0 % de présence ».
            'rate' => $expected > 0 ? min(100.0, round($present / $expected * 100, 1)) : 0.0,
        ];
    }
}
