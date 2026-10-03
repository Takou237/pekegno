<?php

namespace App\Services;

use App\Models\Prestation;
use App\Models\PrestationAction;
use App\Models\PrestationActionReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Notation 5★ façon Play Store.
 * D5 : seul le client de la prestation note ; D11 : une note par action,
 * modifiable ; D12 : prestation en cours ou terminée uniquement.
 * La note d'une prestation = moyenne des notes de ses actions.
 */
class PrestationReviewService
{
    public function __construct(private readonly ActivityLogger $logger) {}

    public function rateAction(PrestationAction $action, User $client, int $rating, ?string $comment = null): PrestationActionReview
    {
        $prestation = $action->prestation;

        abort_unless($prestation && $prestation->client_id === $client->id, 403, 'Seul le client de la prestation peut la noter.');

        if (! $prestation->isRateable()) {
            throw ValidationException::withMessages([
                'prestation' => 'La prestation doit être en cours ou terminée pour être notée.',
            ]);
        }

        if ($action->status === PrestationAction::STATUS_CANCELLED) {
            throw ValidationException::withMessages(['action' => 'Une action annulée ne peut pas être notée.']);
        }

        if ($rating < 1 || $rating > 5) {
            throw ValidationException::withMessages(['rating' => 'La note doit être comprise entre 1 et 5.']);
        }

        return DB::transaction(function () use ($action, $prestation, $client, $rating, $comment) {
            $existing = PrestationActionReview::where('prestation_action_id', $action->id)
                ->where('client_user_id', $client->id)
                ->first();

            $oldRating = $existing?->rating;

            $review = PrestationActionReview::updateOrCreate(
                ['prestation_action_id' => $action->id, 'client_user_id' => $client->id],
                ['prestation_id' => $prestation->id, 'rating' => $rating, 'comment' => $comment],
            );

            $action->update(['rating' => $rating]);
            $this->refreshPrestationRating($prestation);

            $this->logger->log(
                action: $existing ? 'review_updated' : 'review_created',
                entityType: 'prestation-action',
                entityId: $action->id,
                description: $existing
                    ? "Note de l'action « {$action->title} » modifiée : {$oldRating}★ → {$rating}★"
                    : "Action « {$action->title} » notée {$rating}★ par le client",
                oldValues: $existing ? ['rating' => $oldRating] : null,
                newValues: ['rating' => $rating],
                agencyId: $prestation->agency_id,
            );

            return $review;
        });
    }

    public function refreshPrestationRating(Prestation $prestation): void
    {
        $stats = PrestationActionReview::where('prestation_id', $prestation->id)
            ->selectRaw('avg(rating) as avg_rating, count(*) as total')
            ->first();

        $prestation->update([
            'rating_avg' => $stats && $stats->total > 0 ? round((float) $stats->avg_rating, 1) : null,
            'rating_count' => (int) ($stats->total ?? 0),
        ]);
    }

    /** @return array{avg: float|null, count: int, distribution: array<int, int>} */
    public function summaryForPrestation(Prestation $prestation): array
    {
        return $this->summarize(PrestationActionReview::where('prestation_id', $prestation->id));
    }

    /**
     * Agrégats par package, catégorie, commercial, membre d'équipe ou département.
     *
     * @return array{avg: float|null, count: int, distribution: array<int, int>}
     */
    public function aggregate(array $filters, ?array $agencyIds = null): array
    {
        $query = PrestationActionReview::query()
            ->whereHas('prestation', function (Builder $q) use ($filters, $agencyIds) {
                if ($agencyIds !== null) {
                    $q->whereIn('agency_id', $agencyIds);
                }
                foreach (['package_id', 'category_id', 'commercial_id', 'department_id', 'agency_id'] as $key) {
                    if (! empty($filters[$key])) {
                        $q->where($key, $filters[$key]);
                    }
                }
            });

        if (! empty($filters['user_id'])) {
            $query->whereHas('action', fn (Builder $a) => $a->where('assigned_to', $filters['user_id']));
        }

        return $this->summarize($query);
    }

    private function summarize(Builder $query): array
    {
        $counts = (clone $query)
            ->selectRaw('rating, count(*) as total')
            ->groupBy('rating')
            ->pluck('total', 'rating');

        $distribution = [];
        foreach ([5, 4, 3, 2, 1] as $star) {
            $distribution[$star] = (int) ($counts[$star] ?? 0);
        }

        $count = array_sum($distribution);
        $sum = 0;
        foreach ($distribution as $star => $total) {
            $sum += $star * $total;
        }

        return [
            'avg' => $count > 0 ? round($sum / $count, 1) : null,
            'count' => $count,
            'distribution' => $distribution,
        ];
    }
}
