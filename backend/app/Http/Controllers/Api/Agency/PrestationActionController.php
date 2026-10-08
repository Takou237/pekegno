<?php

namespace App\Http\Controllers\Api\Agency;

use App\Http\Controllers\Controller;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionExecution;
use App\Services\AgencyAccessService;
use App\Services\PrestationActionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Actions des prestations : budget (D4), statut, commentaires, journal d'exécution. */
class PrestationActionController extends Controller
{
    public function __construct(
        private readonly PrestationActionService $actions,
        private readonly AgencyAccessService $access,
    ) {}

    public function index(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $actions = $prestation->actions()
            ->with('assignee:id,first_name,last_name', 'reviews:id,prestation_action_id,rating,comment,updated_at')
            ->get()
            ->map(fn (PrestationAction $a) => $a->toArray() + ['progress' => $this->actions->progress($a)]);

        return response()->json([
            'data' => $actions,
            'budget' => [
                'total' => (float) $prestation->budget,
                'allocated' => $prestation->budget_allocated,
                'remaining' => $prestation->budget_remaining,
                'spent' => $prestation->budget_spent,
            ],
        ]);
    }

    public function show(Request $request, Prestation $prestation, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $this->actions->ensureExecutionsGenerated($action);

        return response()->json([
            'action' => $action->load([
                'assignee:id,first_name,last_name',
                'reviews:id,prestation_action_id,rating,comment,updated_at',
                'prestation:id,name,reference,status,client_id,agency_id,department_id,start_date,end_date,budget',
                'prestation.client:id,first_name,last_name',
            ]),
            'progress' => $this->actions->progress($action),
            'weeks' => $this->actions->getWeeksSummary($action),
        ]);
    }

    /**
     * Vue transverse des actions (menus Community Management / Publicité) :
     * toutes les actions d'un type, toutes prestations confondues, dans le périmètre.
     */
    public function board(Request $request): JsonResponse
    {
        $prestationIds = $this->access->scopePrestations(Prestation::query(), $request->user())
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->whereNotIn('status', [Prestation::STATUS_CANCELLED, Prestation::STATUS_REJECTED])
            ->pluck('id');

        $query = PrestationAction::query()
            ->whereIn('prestation_id', $prestationIds)
            ->with('prestation:id,reference,name,client_id,status', 'prestation.client:id,first_name,last_name', 'assignee:id,first_name,last_name')
            ->when($request->type, fn ($q, $t) => $q->whereIn('type', explode(',', $t)))
            ->when($request->status, fn ($q, $s) => $q->whereIn('status', explode(',', $s)))
            ->when($request->assigned_to, fn ($q, $id) => $q->where('assigned_to', $id))
            ->when($request->boolean('overdue'), fn ($q) => $q->whereDate('due_date', '<', today())->whereNotIn('status', PrestationAction::FINISHED_STATUSES))
            ->orderBy('due_date');

        $perPage = min((int) $request->input('per_page', 25), 100);
        $page = $query->paginate($perPage);

        $budget = PrestationAction::query()
            ->whereIn('prestation_id', $prestationIds)
            ->when($request->type, fn ($q, $t) => $q->whereIn('type', explode(',', $t)))
            ->where('status', '!=', PrestationAction::STATUS_CANCELLED)
            ->selectRaw('coalesce(sum(budget), 0) as allocated, coalesce(sum(actual_cost), 0) as spent, coalesce(sum(case when is_pass_through then budget else 0 end), 0) as pass_through')
            ->first();

        return response()->json(array_merge($page->toArray(), [
            'budget' => [
                'allocated' => round((float) $budget->allocated, 2),
                'spent' => round((float) $budget->spent, 2),
                'pass_through' => round((float) $budget->pass_through, 2),
            ],
        ]));
    }

    public function store(Request $request, Prestation $prestation): JsonResponse
    {
        $this->access->authorize($request->user(), $prestation);

        $action = $this->actions->create($prestation, $this->validated($request));

        return response()->json($action->load('assignee:id,first_name,last_name'), 201);
    }

    public function update(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $data = $this->validated($request, update: true);

        // Le community manager ne fait évoluer que l'exécution (statut, coût, commentaire).
        if ($request->user()->role?->name === 'community-manager') {
            $data = array_intersect_key($data, array_flip(['status', 'actual_cost', 'comment']));
        }

        return response()->json($this->actions->update($action, $data)->load('assignee:id,first_name,last_name'));
    }

    public function destroy(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $this->actions->delete($action);

        return response()->json(null, 204);
    }

    public function changeStatus(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $data = $request->validate([
            'status' => ['required', Rule::in(PrestationAction::STATUSES)],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json($this->actions->changeStatus($action, $data['status'], $data['comment'] ?? null, $request->user()));
    }

    public function comments(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        return response()->json(['data' => $action->comments()->with('author:id,first_name,last_name')->get()]);
    }

    public function storeComment(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'attachment_path' => ['nullable', 'string', 'max:2048'],
        ]);

        $comment = $this->actions->addComment($action, $request->user(), $data['body'], $data['attachment_path'] ?? null);

        return response()->json($comment->load('author:id,first_name,last_name'), 201);
    }

    public function logs(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        return response()->json([
            'data' => $action->logs()->with('author:id,first_name,last_name')->get(),
            'progress' => $this->actions->progress($action),
        ]);
    }

    public function storeLog(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $data = $request->validate([
            'done_at' => ['required', 'date'],
            'quantity_done' => ['sometimes', 'integer', 'min:1'],
            'proof_url' => ['nullable', 'string', 'max:2048'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $log = $this->actions->logExecution($action, $request->user(), $data + ['quantity_done' => $data['quantity_done'] ?? 1]);

        return response()->json($log->load('author:id,first_name,last_name'), 201);
    }

    public function executions(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $this->actions->ensureExecutionsGenerated($action);

        $query = $action->executions()
            ->with(['assignee:id,first_name,last_name', 'user:id,first_name,last_name'])
            ->when($request->week, fn ($q, $w) => $q->where('week_number', $w))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->boolean('overdue'), fn ($q) => $q->where('status', '!=', PrestationActionExecution::STATUS_DONE)->where('status', '!=', PrestationActionExecution::STATUS_CANCELLED)->where(function ($sq) {
                $sq->whereDate('scheduled_date', '<', today())->orWhereDate('week_end_date', '<', today());
            }))
            ->orderBy('week_number')
            ->orderBy('occurrence_number');

        return response()->json([
            'data' => $query->get(),
            'weeks' => $this->actions->getWeeksSummary($action),
            'progress' => $this->actions->progress($action),
        ]);
    }

    public function storeExecution(Request $request, PrestationAction $action): JsonResponse
    {
        $this->access->authorize($request->user(), $action->prestation);

        $data = $request->validate([
            'week_number' => ['nullable', 'integer', 'min:1'],
            'title' => ['nullable', 'string', 'max:255'],
            'scheduled_date' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(PrestationActionExecution::STATUSES)],
            'done_at' => ['nullable', 'date'],
            'proof_url' => ['nullable', 'string', 'max:2048'],
            'actual_cost' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
            'assigned_to' => ['nullable', 'uuid', 'exists:users,id'],
        ]);

        $execution = $this->actions->addManualExecution($action, $request->user(), $data);

        return response()->json($execution, 201);
    }

    public function updateExecution(Request $request, PrestationActionExecution $execution): JsonResponse
    {
        $this->access->authorize($request->user(), $execution->action->prestation);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'scheduled_date' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(PrestationActionExecution::STATUSES)],
            'done_at' => ['nullable', 'date'],
            'proof_url' => ['nullable', 'string', 'max:2048'],
            'actual_cost' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
            'assigned_to' => ['nullable', 'uuid', 'exists:users,id'],
        ]);

        $updated = $this->actions->updateExecution($execution, $request->user(), $data);

        return response()->json($updated);
    }

    public function destroyExecution(Request $request, PrestationActionExecution $execution): JsonResponse
    {
        $this->access->authorize($request->user(), $execution->action->prestation);

        $this->actions->deleteExecution($execution);

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $update = false): array
    {
        $required = $update ? 'sometimes' : 'required';

        return $request->validate([
            'type' => ['sometimes', Rule::in(PrestationAction::TYPES)],
            'title' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'platform' => ['nullable', 'string', 'max:50'],
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'frequency' => ['sometimes', Rule::in(PrestationAction::FREQUENCIES)],
            'unit' => ['nullable', 'string', 'max:50'],
            'budget' => ['sometimes', 'numeric', 'min:0'],
            'actual_cost' => ['nullable', 'numeric', 'min:0'],
            'is_pass_through' => ['sometimes', 'boolean'],
            'assigned_to' => ['nullable', 'uuid', 'exists:users,id'],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(PrestationAction::STATUSES)],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
