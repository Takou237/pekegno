<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Prestation Agency : exécution concrète d'un service pour un client.
 * Budget global, période, commercial vendeur ; ses actions prélèvent sur le
 * budget (D4) ; sa validation crée le contrat (D9).
 */
class Prestation extends Model
{
    use HasUuids, SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING_VALIDATION = 'pending_validation';

    public const STATUS_VALIDATED = 'validated';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PENDING_VALIDATION,
        self::STATUS_VALIDATED,
        self::STATUS_IN_PROGRESS,
        self::STATUS_COMPLETED,
        self::STATUS_SUSPENDED,
        self::STATUS_CANCELLED,
        self::STATUS_REJECTED,
    ];

    /** Statuts pour lesquels un motif est obligatoire. */
    public const STATUSES_REQUIRING_REASON = [
        self::STATUS_SUSPENDED,
        self::STATUS_CANCELLED,
        self::STATUS_REJECTED,
    ];

    /** D12 : le client ne note que si la prestation est en cours ou terminée. */
    public const RATEABLE_STATUSES = [self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED];

    /** Transitions autorisées : statut courant => statuts cibles. */
    public const TRANSITIONS = [
        self::STATUS_DRAFT => [self::STATUS_PENDING_VALIDATION, self::STATUS_CANCELLED],
        self::STATUS_PENDING_VALIDATION => [self::STATUS_VALIDATED, self::STATUS_REJECTED, self::STATUS_DRAFT, self::STATUS_CANCELLED],
        self::STATUS_REJECTED => [self::STATUS_DRAFT],
        self::STATUS_VALIDATED => [self::STATUS_IN_PROGRESS, self::STATUS_SUSPENDED, self::STATUS_CANCELLED],
        self::STATUS_IN_PROGRESS => [self::STATUS_COMPLETED, self::STATUS_SUSPENDED, self::STATUS_CANCELLED],
        self::STATUS_SUSPENDED => [self::STATUS_IN_PROGRESS, self::STATUS_CANCELLED],
        self::STATUS_COMPLETED => [],
        self::STATUS_CANCELLED => [],
    ];

    public const COMMISSION_TYPES = ['percent', 'fixed'];

    protected $fillable = [
        'reference',
        'agency_id',
        'department_id',
        'category_id',
        'offer_id',
        'name',
        'description',
        'client_id',
        'company_id',
        'commercial_id',
        'package_id',
        'contract_id',
        'start_date',
        'end_date',
        'budget',
        'commission_type',
        'commission_value',
        'status',
        'status_reason',
        'rating_avg',
        'rating_count',
        'validated_by',
        'validated_at',
        'created_by',
    ];

    protected $appends = ['budget_allocated', 'budget_remaining', 'budget_spent', 'pass_through_budget'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'budget' => 'decimal:2',
            'commission_value' => 'decimal:2',
            'rating_avg' => 'decimal:1',
            'rating_count' => 'integer',
            'validated_at' => 'datetime',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AgencyCategory::class, 'category_id');
    }

    /** Offre de prestation souscrite (null pour les prestations issues d'un package). */
    public function offer(): BelongsTo
    {
        return $this->belongsTo(PrestationOffer::class, 'offer_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Commercial::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPack::class, 'package_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(PrestationAction::class)->orderBy('sort_order');
    }

    public function teamMembers(): HasMany
    {
        return $this->hasMany(PrestationTeamMember::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(PrestationActionReview::class);
    }

    /** Somme des budgets des actions non annulées. */
    public function getBudgetAllocatedAttribute(): float
    {
        return round((float) $this->activeActions()->sum('budget'), 2);
    }

    public function getBudgetRemainingAttribute(): float
    {
        return round((float) $this->budget - $this->budget_allocated, 2);
    }

    /** Coût réel saisi sur les actions. */
    public function getBudgetSpentAttribute(): float
    {
        return round((float) $this->activeActions()->sum('actual_cost'), 2);
    }

    /** Part du budget réservée au budget publicitaire client (D7/D15). */
    public function getPassThroughBudgetAttribute(): float
    {
        return round((float) $this->activeActions()->where('is_pass_through', true)->sum('budget'), 2);
    }

    /**
     * Actions non annulées : utilise la relation déjà chargée quand elle l'est
     * (évite une requête par prestation dans les listes).
     */
    private function activeActions()
    {
        $actions = $this->relationLoaded('actions') ? $this->actions : $this->actions()->get();

        return $actions->where('status', '!=', PrestationAction::STATUS_CANCELLED);
    }

    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::TRANSITIONS[$this->status] ?? [], true);
    }

    public function isRateable(): bool
    {
        return in_array($this->status, self::RATEABLE_STATUSES, true);
    }

    public function scopeOfAgencies(Builder $query, ?array $agencyIds): Builder
    {
        return $agencyIds === null ? $query : $query->whereIn('agency_id', $agencyIds);
    }

    public static function generateReference(): string
    {
        $year = now()->format('Y');
        $prefix = "PRS-{$year}-";

        $max = static::withTrashed()
            ->where('reference', 'like', $prefix.'%')
            ->pluck('reference')
            ->map(fn (string $ref): int => (int) substr($ref, strlen($prefix)))
            ->max() ?? 0;

        return $prefix.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }
}
