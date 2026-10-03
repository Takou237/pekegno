<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionReview;
use App\Services\PrestationReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Portail client — « Mes prestations » Agency et notation 5★ par action
 * (D5 client uniquement, D11 une note par action modifiable, D12 en cours / terminée).
 */
class ClientPrestationController extends Controller
{
    /** Statuts visibles par le client (pas les brouillons ni les refus internes). */
    private const VISIBLE_STATUSES = [
        Prestation::STATUS_VALIDATED,
        Prestation::STATUS_IN_PROGRESS,
        Prestation::STATUS_COMPLETED,
        Prestation::STATUS_SUSPENDED,
    ];

    public function __construct(private readonly PrestationReviewService $reviews) {}

    public function index(Request $request): JsonResponse
    {
        $prestations = Prestation::query()
            ->where('client_id', $request->user()->id)
            ->whereIn('status', self::VISIBLE_STATUSES)
            ->with('package:id,name', 'category:id,name', 'contract:id,number,status,end_date')
            ->withCount('actions')
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (Prestation $p) => $this->present($p));

        return response()->json(['data' => $prestations]);
    }

    public function show(Request $request, Prestation $prestation): JsonResponse
    {
        $this->authorizeClient($request, $prestation);

        $prestation->load('package:id,name', 'category:id,name', 'contract:id,number,status,start_date,end_date');

        return response()->json($this->present($prestation) + [
            'rating_summary' => $this->reviews->summaryForPrestation($prestation),
            'actions' => $this->actionsFor($request, $prestation),
        ]);
    }

    public function actions(Request $request, Prestation $prestation): JsonResponse
    {
        $this->authorizeClient($request, $prestation);

        return response()->json(['data' => $this->actionsFor($request, $prestation)]);
    }

    /** Crée OU modifie la note du client sur une action (upsert). */
    public function review(Request $request, PrestationAction $action): JsonResponse
    {
        $prestation = $action->prestation;
        abort_unless($prestation && $prestation->client_id === $request->user()->id, 404, 'Action introuvable.');

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $review = $this->reviews->rateAction($action, $request->user(), (int) $data['rating'], $data['comment'] ?? null);

        return response()->json([
            'review' => $review,
            'prestation' => [
                'rating_avg' => $prestation->fresh()->rating_avg,
                'rating_count' => $prestation->fresh()->rating_count,
            ],
        ]);
    }

    private function authorizeClient(Request $request, Prestation $prestation): void
    {
        abort_unless(
            $prestation->client_id === $request->user()->id && in_array($prestation->status, self::VISIBLE_STATUSES, true),
            404,
            'Prestation introuvable.',
        );
    }

    private function actionsFor(Request $request, Prestation $prestation): array
    {
        $myReviews = PrestationActionReview::where('prestation_id', $prestation->id)
            ->where('client_user_id', $request->user()->id)
            ->get()
            ->keyBy('prestation_action_id');

        return $prestation->actions()
            ->where('status', '!=', PrestationAction::STATUS_CANCELLED)
            ->get(['id', 'prestation_id', 'type', 'title', 'platform', 'quantity', 'frequency', 'unit', 'status', 'due_date'])
            ->map(fn (PrestationAction $a) => [
                'id' => $a->id,
                'type' => $a->type,
                'title' => $a->title,
                'platform' => $a->platform,
                'quantity' => $a->quantity,
                'frequency' => $a->frequency,
                'unit' => $a->unit,
                'status' => $a->status,
                'due_date' => $a->due_date?->toDateString(),
                'my_review' => ($r = $myReviews->get($a->id)) ? ['rating' => $r->rating, 'comment' => $r->comment, 'updated_at' => $r->updated_at] : null,
                'can_rate' => $prestation->isRateable(),
            ])
            ->all();
    }

    private function present(Prestation $p): array
    {
        return [
            'id' => $p->id,
            'reference' => $p->reference,
            'name' => $p->name,
            'description' => $p->description,
            'status' => $p->status,
            'start_date' => $p->start_date?->toDateString(),
            'end_date' => $p->end_date?->toDateString(),
            'package' => $p->package?->only('id', 'name'),
            'category' => $p->category?->only('id', 'name'),
            'contract' => $p->contract?->only('id', 'number', 'status'),
            'rating_avg' => $p->rating_avg !== null ? (float) $p->rating_avg : null,
            'rating_count' => $p->rating_count,
            'can_rate' => $p->isRateable(),
            'actions_count' => $p->actions_count ?? null,
        ];
    }
}
