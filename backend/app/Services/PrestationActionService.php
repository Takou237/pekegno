<?php

namespace App\Services;

use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionComment;
use App\Models\PrestationActionExecution;
use App\Models\PrestationActionLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Actions d'une prestation. D4 : blocage strict — la somme des budgets des
 * actions (hors annulées) ne peut pas dépasser le budget de la prestation.
 */
class PrestationActionService
{
    /** Seuils d'alerte de consommation du budget (en %). */
    public const BUDGET_ALERT_THRESHOLDS = [80, 100];

    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly AgencyNotifier $notifier,
    ) {}

    public function create(Prestation $prestation, array $data): PrestationAction
    {
        $this->assertEditable($prestation);
        $this->assertBudget($prestation, (float) ($data['budget'] ?? 0));

        $action = PrestationAction::create($data + [
            'prestation_id' => $prestation->id,
            'status' => PrestationAction::STATUS_TODO,
            'sort_order' => (int) $prestation->actions()->max('sort_order') + 1,
        ]);

        $this->logger->log(
            action: 'created',
            entityType: 'prestation-action',
            entityId: $action->id,
            description: "Action « {$action->title} » ajoutée à la prestation {$prestation->reference}",
            newValues: ['budget' => (float) $action->budget],
            agencyId: $prestation->agency_id,
        );

        $this->ensureExecutionsGenerated($action);
        $this->checkBudgetConsumption($prestation->fresh());

        return $action;
    }

    public function update(PrestationAction $action, array $data): PrestationAction
    {
        $prestation = $action->prestation;
        $this->assertEditable($prestation);

        $newStatus = $data['status'] ?? $action->status;
        if ($newStatus !== PrestationAction::STATUS_CANCELLED) {
            $budget = (float) ($data['budget'] ?? $action->budget);
            $this->assertBudget($prestation, $budget, $action->id);
        }

        $old = $action->only(array_keys($data));
        $action->update($data);

        $this->logger->log(
            action: 'updated',
            entityType: 'prestation-action',
            entityId: $action->id,
            description: "Action « {$action->title} » modifiée (prestation {$prestation->reference})",
            oldValues: $old,
            newValues: $data,
            agencyId: $prestation->agency_id,
        );

        $this->checkBudgetConsumption($prestation->fresh());

        return $action->fresh();
    }

    public function changeStatus(PrestationAction $action, string $status, ?string $comment, User $actor): PrestationAction
    {
        if (! in_array($status, PrestationAction::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => 'Statut d\'action inconnu.']);
        }

        $prestation = $action->prestation;
        $this->assertEditable($prestation);

        // Réactiver une action annulée la fait de nouveau compter dans le budget.
        if ($action->status === PrestationAction::STATUS_CANCELLED && $status !== PrestationAction::STATUS_CANCELLED) {
            $this->assertBudget($prestation, (float) $action->budget, $action->id);
        }

        $oldStatus = $action->status;

        DB::transaction(function () use ($action, $status, $comment, $actor) {
            $action->update(['status' => $status] + ($comment !== null ? ['comment' => $comment] : []));

            if ($comment) {
                PrestationActionComment::create([
                    'prestation_action_id' => $action->id,
                    'user_id' => $actor->id,
                    'body' => $comment,
                ]);
            }
        });

        $this->logger->log(
            action: 'status_changed',
            entityType: 'prestation-action',
            entityId: $action->id,
            description: "Action « {$action->title} » : {$oldStatus} → {$status}",
            oldValues: ['status' => $oldStatus],
            newValues: ['status' => $status],
            agencyId: $prestation->agency_id,
        );

        return $action->fresh();
    }

    public function delete(PrestationAction $action): void
    {
        $prestation = $action->prestation;
        $this->assertEditable($prestation);

        $action->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'prestation-action',
            entityId: $action->id,
            description: "Action « {$action->title} » supprimée (prestation {$prestation->reference})",
            agencyId: $prestation->agency_id,
        );
    }

    public function addComment(PrestationAction $action, User $author, string $body, ?string $attachmentPath = null): PrestationActionComment
    {
        $comment = PrestationActionComment::create([
            'prestation_action_id' => $action->id,
            'user_id' => $author->id,
            'body' => $body,
            'attachment_path' => $attachmentPath,
        ]);

        $action->update(['comment' => $body]);

        return $comment;
    }

    /**
     * Enregistre une réalisation (ex. 1 vidéo postée). Le coût éventuel
     * s'ajoute au coût réel de l'action.
     */
    public function logExecution(PrestationAction $action, User $author, array $data): PrestationActionLog
    {
        $this->assertEditable($action->prestation);

        $log = DB::transaction(function () use ($action, $author, $data) {
            $log = PrestationActionLog::create($data + [
                'prestation_action_id' => $action->id,
                'user_id' => $author->id,
            ]);

            if (! empty($data['cost'])) {
                $action->update(['actual_cost' => round((float) $action->actual_cost + (float) $data['cost'], 2)]);
            }

            if ($action->status === PrestationAction::STATUS_TODO) {
                $action->update(['status' => PrestationAction::STATUS_IN_PROGRESS]);
            }

            return $log;
        });

        $this->checkBudgetConsumption($action->prestation->fresh());

        return $log;
    }

    /**
     * Progression d'une action : quantité réalisée / quantité attendue sur la
     * période de la prestation (ex. 3/semaine × nb de semaines).
     *
     * @return array{done: int, expected: int, percent: float}
     */
    public function progress(PrestationAction $action): array
    {
        $this->ensureExecutionsGenerated($action);

        $totalExpected = $action->executions()->where('status', '!=', PrestationActionExecution::STATUS_CANCELLED)->count();
        $totalDone = $action->executions()->where('status', PrestationActionExecution::STATUS_DONE)->count();

        if ($totalExpected > 0) {
            return [
                'done' => $totalDone,
                'expected' => $totalExpected,
                'percent' => round(min(100, $totalDone / $totalExpected * 100), 1),
            ];
        }

        $prestation = $action->prestation;
        $start = $action->start_date ?? $prestation->start_date;
        $end = $action->due_date ?? $prestation->end_date;
        $days = max(1, (int) $start->diffInDays($end) + 1);

        $periods = match ($action->frequency) {
            'per_day' => $days,
            'per_week' => (int) ceil($days / 7),
            'per_month' => (int) ceil($days / 30),
            default => 1,
        };

        $expected = max(1, $action->quantity * $periods);
        $done = $action->quantity_done;

        return [
            'done' => $done,
            'expected' => $expected,
            'percent' => round(min(100, $done / $expected * 100), 1),
        ];
    }

    /**
     * Résumé par semaine de l'action pour les filtres et l'affichage hebdomadaire.
     */
    public function getWeeksSummary(PrestationAction $action): array
    {
        $this->ensureExecutionsGenerated($action);

        $executions = $action->executions()->get();
        $grouped = $executions->groupBy('week_number');

        $summaries = [];
        $today = today();

        foreach ($grouped as $weekNumber => $execs) {
            $first = $execs->first();
            $startDate = $first->week_start_date;
            $endDate = $first->week_end_date;

            $isCurrent = false;
            if ($startDate && $endDate) {
                $isCurrent = $today->betweenIncluded($startDate, $endDate);
            }

            $total = $execs->where('status', '!=', PrestationActionExecution::STATUS_CANCELLED)->count();
            $done = $execs->where('status', PrestationActionExecution::STATUS_DONE)->count();
            $overdue = $execs->filter(fn ($e) => $e->is_overdue)->count();

            $summaries[] = [
                'week_number' => (int) $weekNumber,
                'week_start_date' => $startDate?->format('Y-m-d'),
                'week_end_date' => $endDate?->format('Y-m-d'),
                'total' => $total,
                'done' => $done,
                'overdue' => $overdue,
                'is_current' => $isCurrent,
                'percent' => $total > 0 ? round(($done / $total) * 100, 1) : 0,
            ];
        }

        return $summaries;
    }

    /**
     * Génère automatiquement les occurrences initiales si elles n'existent pas encore.
     */
    public function ensureExecutionsGenerated(PrestationAction $action): void
    {
        if ($action->executions()->exists()) {
            return;
        }

        $prestation = $action->prestation;
        $start = $action->start_date ? Carbon::parse($action->start_date) : ($prestation?->start_date ? Carbon::parse($prestation->start_date) : today());
        $end = $action->due_date ? Carbon::parse($action->due_date) : ($prestation?->end_date ? Carbon::parse($prestation->end_date) : $start->copy()->addMonths(1));

        if ($end->lt($start)) {
            $end = $start->copy()->addDays(7);
        }

        $days = max(1, (int) $start->diffInDays($end) + 1);
        $qty = max(1, (int) $action->quantity);
        $freq = $action->frequency ?: 'once';

        $executionsToInsert = [];
        $now = now();

        if ($freq === 'per_week') {
            $totalWeeks = max(1, (int) ceil($days / 7));
            for ($w = 1; $w <= $totalWeeks; $w++) {
                $wStart = $start->copy()->addDays(($w - 1) * 7);
                $wEnd = $w === $totalWeeks ? $end->copy() : $start->copy()->addDays($w * 7 - 1);
                if ($wEnd->gt($end)) {
                    $wEnd = $end->copy();
                }

                for ($occ = 1; $occ <= $qty; $occ++) {
                    $schedOffset = $qty > 1 ? min((int) floor(6 / ($qty - 1)) * ($occ - 1), 6) : 0;
                    $schedDate = $wStart->copy()->addDays($schedOffset);
                    if ($schedDate->gt($wEnd)) {
                        $schedDate = $wEnd->copy();
                    }

                    $executionsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'prestation_action_id' => $action->id,
                        'week_number' => $w,
                        'week_start_date' => $wStart->format('Y-m-d'),
                        'week_end_date' => $wEnd->format('Y-m-d'),
                        'occurrence_number' => $occ,
                        'title' => "Action #{$occ} - Semaine {$w}",
                        'status' => PrestationActionExecution::STATUS_TODO,
                        'scheduled_date' => $schedDate->format('Y-m-d'),
                        'done_at' => null,
                        'proof_url' => null,
                        'actual_cost' => null,
                        'note' => null,
                        'is_manual' => false,
                        'user_id' => null,
                        'assigned_to' => $action->assigned_to,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        } elseif ($freq === 'per_month') {
            $totalMonths = max(1, (int) ceil($days / 30));
            for ($m = 1; $m <= $totalMonths; $m++) {
                $mStart = $start->copy()->addDays(($m - 1) * 30);
                $mEnd = $m === $totalMonths ? $end->copy() : $start->copy()->addDays($m * 30 - 1);
                if ($mEnd->gt($end)) {
                    $mEnd = $end->copy();
                }

                for ($occ = 1; $occ <= $qty; $occ++) {
                    $executionsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'prestation_action_id' => $action->id,
                        'week_number' => $m,
                        'week_start_date' => $mStart->format('Y-m-d'),
                        'week_end_date' => $mEnd->format('Y-m-d'),
                        'occurrence_number' => $occ,
                        'title' => "Action #{$occ} - Mois {$m}",
                        'status' => PrestationActionExecution::STATUS_TODO,
                        'scheduled_date' => $mStart->format('Y-m-d'),
                        'done_at' => null,
                        'proof_url' => null,
                        'actual_cost' => null,
                        'note' => null,
                        'is_manual' => false,
                        'user_id' => null,
                        'assigned_to' => $action->assigned_to,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        } elseif ($freq === 'per_day') {
            for ($d = 1; $d <= $days; $d++) {
                $dDate = $start->copy()->addDays($d - 1);
                $wNum = (int) ceil($d / 7);
                for ($occ = 1; $occ <= $qty; $occ++) {
                    $executionsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'prestation_action_id' => $action->id,
                        'week_number' => $wNum,
                        'week_start_date' => $dDate->format('Y-m-d'),
                        'week_end_date' => $dDate->format('Y-m-d'),
                        'occurrence_number' => $occ,
                        'title' => "Action #{$occ} - Jour {$d}",
                        'status' => PrestationActionExecution::STATUS_TODO,
                        'scheduled_date' => $dDate->format('Y-m-d'),
                        'done_at' => null,
                        'proof_url' => null,
                        'actual_cost' => null,
                        'note' => null,
                        'is_manual' => false,
                        'user_id' => null,
                        'assigned_to' => $action->assigned_to,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        } else {
            for ($occ = 1; $occ <= $qty; $occ++) {
                $executionsToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'prestation_action_id' => $action->id,
                    'week_number' => 1,
                    'week_start_date' => $start->format('Y-m-d'),
                    'week_end_date' => $end->format('Y-m-d'),
                    'occurrence_number' => $occ,
                    'title' => "Action #{$occ}",
                    'status' => PrestationActionExecution::STATUS_TODO,
                    'scheduled_date' => $start->format('Y-m-d'),
                    'done_at' => null,
                    'proof_url' => null,
                    'actual_cost' => null,
                    'note' => null,
                    'is_manual' => false,
                    'user_id' => null,
                    'assigned_to' => $action->assigned_to,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if (! empty($executionsToInsert)) {
            PrestationActionExecution::insert($executionsToInsert);
        }

        // Backfill depuis les logs existants
        $logs = $action->logs()->orderBy('done_at')->get();
        if ($logs->isNotEmpty()) {
            $createdExecs = $action->executions()->orderBy('week_number')->orderBy('occurrence_number')->get();
            $logIndex = 0;
            foreach ($createdExecs as $exec) {
                if ($logIndex >= $logs->count()) {
                    break;
                }
                $log = $logs[$logIndex];
                $exec->update([
                    'status' => PrestationActionExecution::STATUS_DONE,
                    'done_at' => $log->done_at,
                    'proof_url' => $log->proof_url,
                    'actual_cost' => $log->cost,
                    'note' => $log->note,
                    'user_id' => $log->user_id,
                ]);
                $logIndex++;
            }
        }
    }

    /**
     * Ajoute manuellement une exécution liée à l'action globale.
     */
    public function addManualExecution(PrestationAction $action, User $actor, array $data): PrestationActionExecution
    {
        $this->assertEditable($action->prestation);
        $this->ensureExecutionsGenerated($action);

        $weekNumber = (int) ($data['week_number'] ?? 1);
        $maxOcc = (int) $action->executions()->where('week_number', $weekNumber)->max('occurrence_number') + 1;

        $targetDate = ! empty($data['scheduled_date'])
            ? Carbon::parse($data['scheduled_date'])
            : (! empty($data['done_at']) ? Carbon::parse($data['done_at']) : today());

        $existingWeekExec = $action->executions()->where('week_number', $weekNumber)->first();
        $wStart = $existingWeekExec?->week_start_date ?? $targetDate->copy()->startOfWeek();
        $wEnd = $existingWeekExec?->week_end_date ?? $targetDate->copy()->endOfWeek();

        $status = $data['status'] ?? PrestationActionExecution::STATUS_TODO;
        $doneAt = $status === PrestationActionExecution::STATUS_DONE ? ($data['done_at'] ?? now()) : null;

        $execution = PrestationActionExecution::create([
            'prestation_action_id' => $action->id,
            'week_number' => $weekNumber,
            'week_start_date' => $wStart,
            'week_end_date' => $wEnd,
            'occurrence_number' => $maxOcc,
            'title' => $data['title'] ?? "Action supplémentaire #{$maxOcc} - Semaine {$weekNumber}",
            'status' => $status,
            'scheduled_date' => $data['scheduled_date'] ?? $targetDate->format('Y-m-d'),
            'done_at' => $doneAt,
            'proof_url' => $data['proof_url'] ?? null,
            'actual_cost' => ! empty($data['actual_cost']) ? (float) $data['actual_cost'] : null,
            'note' => $data['note'] ?? null,
            'is_manual' => true,
            'user_id' => $status === PrestationActionExecution::STATUS_DONE ? $actor->id : null,
            'assigned_to' => $data['assigned_to'] ?? $action->assigned_to,
        ]);

        $this->syncActionAfterExecutionChange($action);

        $this->logger->log(
            action: 'created',
            entityType: 'prestation-action-execution',
            entityId: $execution->id,
            description: "Exécution manuelle ajoutée pour l'action « {$action->title} » (Semaine {$weekNumber})",
            agencyId: $action->prestation->agency_id,
        );

        return $execution->fresh(['assignee:id,first_name,last_name', 'user:id,first_name,last_name']);
    }

    /**
     * Met à jour une exécution (marquée comme faite, renseignement preuve, coût, etc.).
     */
    public function updateExecution(PrestationActionExecution $execution, User $actor, array $data): PrestationActionExecution
    {
        $action = $execution->action;
        $this->assertEditable($action->prestation);

        $newStatus = $data['status'] ?? $execution->status;
        $doneAt = $data['done_at'] ?? $execution->done_at;

        if ($newStatus === PrestationActionExecution::STATUS_DONE && empty($doneAt)) {
            $doneAt = now();
        } elseif ($newStatus !== PrestationActionExecution::STATUS_DONE && $execution->status === PrestationActionExecution::STATUS_DONE) {
            $doneAt = null;
        }

        $userId = $newStatus === PrestationActionExecution::STATUS_DONE ? ($execution->user_id ?? $actor->id) : $execution->user_id;

        $execution->update([
            'title' => $data['title'] ?? $execution->title,
            'status' => $newStatus,
            'scheduled_date' => $data['scheduled_date'] ?? $execution->scheduled_date,
            'done_at' => $doneAt,
            'proof_url' => array_key_exists('proof_url', $data) ? $data['proof_url'] : $execution->proof_url,
            'actual_cost' => array_key_exists('actual_cost', $data) ? $data['actual_cost'] : $execution->actual_cost,
            'note' => array_key_exists('note', $data) ? $data['note'] : $execution->note,
            'assigned_to' => array_key_exists('assigned_to', $data) ? $data['assigned_to'] : $execution->assigned_to,
            'user_id' => $userId,
        ]);

        $this->syncActionAfterExecutionChange($action);

        $this->logger->log(
            action: 'updated',
            entityType: 'prestation-action-execution',
            entityId: $execution->id,
            description: "Exécution « {$execution->title} » mise à jour ({$newStatus})",
            agencyId: $action->prestation->agency_id,
        );

        return $execution->fresh(['assignee:id,first_name,last_name', 'user:id,first_name,last_name']);
    }

    public function deleteExecution(PrestationActionExecution $execution): void
    {
        $action = $execution->action;
        $this->assertEditable($action->prestation);

        $execution->delete();

        $this->syncActionAfterExecutionChange($action);
    }

    public function syncActionAfterExecutionChange(PrestationAction $action): void
    {
        $cost = (float) $action->executions()->where('status', PrestationActionExecution::STATUS_DONE)->sum('actual_cost');
        if ($cost > 0 || $action->actual_cost > 0) {
            $action->update(['actual_cost' => round($cost, 2)]);
        }

        $hasDone = $action->executions()->where('status', PrestationActionExecution::STATUS_DONE)->exists();

        if ($action->status === PrestationAction::STATUS_TODO && $hasDone) {
            $action->update(['status' => PrestationAction::STATUS_IN_PROGRESS]);
        }

        $this->checkBudgetConsumption($action->prestation->fresh());
    }

    /** D4 : blocage strict du budget. */
    public function assertBudget(Prestation $prestation, float $budget, ?string $ignoreActionId = null): void
    {
        if ($budget < 0) {
            throw ValidationException::withMessages(['budget' => 'Le budget d\'une action ne peut pas être négatif.']);
        }

        $allocated = (float) $prestation->actions()
            ->where('status', '!=', PrestationAction::STATUS_CANCELLED)
            ->when($ignoreActionId, fn ($q) => $q->where('id', '!=', $ignoreActionId))
            ->sum('budget');

        $remaining = round((float) $prestation->budget - $allocated, 2);

        if ($budget > $remaining + 0.001) {
            throw ValidationException::withMessages([
                'budget' => "Budget restant insuffisant : {$remaining} FCFA disponibles sur la prestation.",
            ]);
        }
    }

    private function assertEditable(Prestation $prestation): void
    {
        if (in_array($prestation->status, [Prestation::STATUS_COMPLETED, Prestation::STATUS_CANCELLED], true)) {
            throw ValidationException::withMessages([
                'prestation' => 'La prestation est terminée ou annulée : ses actions ne sont plus modifiables.',
            ]);
        }
    }

    /** Alerte les responsables quand le coût réel atteint 80 % puis 100 % du budget. */
    public function checkBudgetConsumption(Prestation $prestation): void
    {
        $budget = (float) $prestation->budget;
        if ($budget <= 0) {
            return;
        }

        $percent = $prestation->budget_spent / $budget * 100;

        foreach (self::BUDGET_ALERT_THRESHOLDS as $threshold) {
            if ($percent < $threshold) {
                continue;
            }

            foreach ($this->notifier->prestationOwnerIds($prestation) as $userId) {
                $this->notifier->notify(
                    userId: $userId,
                    type: 'prestation_budget',
                    title: "Budget consommé à {$threshold} % — {$prestation->reference}",
                    body: "La prestation « {$prestation->name} » a consommé {$prestation->budget_spent} FCFA sur {$budget} FCFA.",
                    entityType: 'prestation',
                    entityId: $prestation->id,
                    data: ['threshold' => $threshold, 'spent' => $prestation->budget_spent],
                    dedupeKey: "prestation:{$prestation->id}:budget:{$threshold}",
                );
            }
        }
    }
}
