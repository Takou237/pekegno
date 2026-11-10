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
     * @param  (callable(TrainingSession): array<int, string>)|null  $expectedLearners  apprenants attendus d'une séance (défaut : règle unique, cf. expectedLearners())
     * @return array{expected: int, present: int, marked: int, rate: float}
     */
    public static function compute(Collection $sessions, ?callable $expectedLearners = null, ?Carbon $now = null): array
    {
        $now ??= now();
        $expectedLearners ??= self::expectedLearners($sessions);

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

    /**
     * Apprenants attendus d'une séance — une seule définition pour tous les
     * écrans (B22) : les participants non annulés de la session ; à défaut
     * (session sans participants), les inscrits actifs de sa formation. Un
     * apprenant n'est donc jamais attendu dans une session d'une autre cohorte
     * de la même formation.
     *
     * @param  Collection<int, TrainingSession>  $sessions
     * @return \Closure(TrainingSession): array<int, string>
     */
    public static function expectedLearners(Collection $sessions): \Closure
    {
        $ids = $sessions->pluck('id')->filter()->values();
        $courseIds = $sessions->pluck('course_id')->filter()->unique()->values();

        $bySession = $ids->isEmpty() ? [] : \Illuminate\Support\Facades\DB::table('session_participants')
            ->join('formation_enrollments', 'formation_enrollments.id', '=', 'session_participants.formation_enrollment_id')
            ->whereIn('session_participants.training_session_id', $ids)
            ->where('session_participants.status', '!=', 'cancelled')
            ->get(['session_participants.training_session_id', 'formation_enrollments.learner_user_id'])
            ->groupBy('training_session_id')
            ->map(fn ($rows) => $rows->pluck('learner_user_id')->filter()->unique()->values()->all())
            ->all();

        $byCourse = $courseIds->isEmpty() ? [] : \App\Models\FormationEnrollment::query()
            ->whereIn('course_id', $courseIds)
            ->active()
            ->get(['course_id', 'learner_user_id'])
            ->groupBy('course_id')
            ->map(fn ($rows) => $rows->pluck('learner_user_id')->filter()->unique()->values()->all())
            ->all();

        return fn (TrainingSession $session) => $bySession[$session->id] ?? $byCourse[$session->course_id] ?? [];
    }
}
