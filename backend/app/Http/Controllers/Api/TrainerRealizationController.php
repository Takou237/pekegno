<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionExecution;
use App\Models\User;
use App\Services\PrestationActionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * « Mes réalisations » de l'espace formateur : les exécutions d'actions de
 * production du pôle studio assignées au compte connecté.
 *
 * Une exécution est à moi si elle m'est assignée directement, ou si elle n'est
 * assignée à personne et que son action m'est assignée. Le formateur ne peut
 * que faire avancer sa réalisation (statut, date, preuve, coût, note) : titre,
 * planification, affectation et annulation restent au pôle studio. La mise à
 * jour passe par PrestationActionService::updateExecution pour garder les
 * mêmes effets (statut et coût de l'action, journal d'activité).
 */
class TrainerRealizationController extends Controller
{
    /** Prestations dont les actions sont encore en cours de réalisation. */
    private const ACTIVE_PRESTATION_STATUSES = [
        Prestation::STATUS_VALIDATED,
        Prestation::STATUS_IN_PROGRESS,
    ];

    /** Statuts que le formateur peut donner à sa réalisation. */
    private const TRAINER_STATUSES = [
        PrestationActionExecution::STATUS_TODO,
        PrestationActionExecution::STATUS_IN_PROGRESS,
        PrestationActionExecution::STATUS_DONE,
    ];

    public function __construct(private readonly PrestationActionService $actions) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(PrestationActionExecution::STATUSES)],
            'overdue' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $user = $request->user();
        $this->generateMissingExecutions($user);

        $page = $this->mine($user)
            ->with([
                'action:id,prestation_id,title,type,status,due_date',
                'action.prestation:id,reference,name,status,department_id,client_id,agency_id,start_date,end_date',
                'action.prestation.department:id,name,type',
                'action.prestation.client:id,first_name,last_name',
                'action.prestation.agency:id,name',
                'assignee:id,first_name,last_name',
                'user:id,first_name,last_name',
            ])
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($request->boolean('overdue'), fn ($q) => $this->overdue($q))
            // Les réalisations ouvertes d'abord, puis par échéance.
            ->orderByRaw('CASE status WHEN ? THEN 0 WHEN ? THEN 1 WHEN ? THEN 2 ELSE 3 END', [
                PrestationActionExecution::STATUS_IN_PROGRESS,
                PrestationActionExecution::STATUS_TODO,
                PrestationActionExecution::STATUS_DONE,
            ])
            ->orderByRaw('COALESCE(scheduled_date, week_end_date) IS NULL')
            ->orderByRaw('COALESCE(scheduled_date, week_end_date)')
            ->orderBy('occurrence_number')
            ->paginate($filters['per_page'] ?? 20);

        $counts = $this->mine($user)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $summary = [
            'total' => (int) $counts->sum(),
            'todo' => (int) ($counts[PrestationActionExecution::STATUS_TODO] ?? 0),
            'in_progress' => (int) ($counts[PrestationActionExecution::STATUS_IN_PROGRESS] ?? 0),
            'done' => (int) ($counts[PrestationActionExecution::STATUS_DONE] ?? 0),
            'overdue' => $this->overdue($this->mine($user))->count(),
        ];

        return response()->json(array_merge($page->toArray(), ['summary' => $summary]));
    }

    public function update(Request $request, PrestationActionExecution $execution): JsonResponse
    {
        $user = $request->user();

        if (! $this->mine($user)->whereKey($execution->getKey())->exists()) {
            abort(403, "Cette réalisation ne vous est pas assignée.");
        }

        if ($execution->status === PrestationActionExecution::STATUS_CANCELLED) {
            abort(422, 'Cette réalisation a été annulée par le pôle studio.');
        }

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(self::TRAINER_STATUSES)],
            'done_at' => ['nullable', 'date', 'before_or_equal:now'],
            'proof_url' => ['nullable', 'string', 'max:2048'],
            'proof_file' => ['nullable', 'string', 'max:2048'],
            'actual_cost' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->actions->updateExecution($execution, $user, $data);

        return response()->json($execution->fresh([
            'action:id,prestation_id,title,type,status,due_date',
            'action.prestation:id,reference,name,status,department_id,client_id,agency_id,start_date,end_date',
            'action.prestation.department:id,name,type',
            'action.prestation.client:id,first_name,last_name',
            'action.prestation.agency:id,name',
            'assignee:id,first_name,last_name',
            'user:id,first_name,last_name',
        ]));
    }

    /** Exécutions du pôle studio assignées à l'utilisateur. */
    private function mine(User $user): Builder
    {
        return PrestationActionExecution::query()
            ->where(function (Builder $q) use ($user) {
                $q->where('assigned_to', $user->id)
                    ->orWhere(fn (Builder $q) => $q->whereNull('assigned_to')
                        ->whereHas('action', fn (Builder $a) => $a->where('assigned_to', $user->id)));
            })
            ->whereHas('action.prestation', fn (Builder $p) => $this->studio($p));
    }

    private function studio(Builder $prestations): Builder
    {
        return $prestations->whereHas('department', fn (Builder $d) => $d->where('type', Department::TYPE_STUDIO));
    }

    /** Même définition que PrestationActionExecution::is_overdue. */
    private function overdue(Builder $query): Builder
    {
        return $query
            ->whereNotIn('status', [PrestationActionExecution::STATUS_DONE, PrestationActionExecution::STATUS_CANCELLED])
            ->where(fn (Builder $q) => $q
                ->whereDate('scheduled_date', '<', today())
                ->orWhere(fn (Builder $q) => $q->whereNull('scheduled_date')->whereDate('week_end_date', '<', today())));
    }

    /**
     * Les exécutions sont générées à la première ouverture d'une action ; une
     * action qui m'est assignée et jamais ouverte n'apparaîtrait pas sans ça.
     */
    private function generateMissingExecutions(User $user): void
    {
        PrestationAction::query()
            ->where('assigned_to', $user->id)
            ->whereDoesntHave('executions')
            ->whereHas('prestation', fn (Builder $p) => $this->studio($p)->whereIn('status', self::ACTIVE_PRESTATION_STATUSES))
            ->with('prestation')
            ->get()
            ->each(fn (PrestationAction $action) => $this->actions->ensureExecutionsGenerated($action));
    }
}
