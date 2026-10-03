<?php

namespace App\Services;

use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionComment;
use App\Models\PrestationActionLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
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
