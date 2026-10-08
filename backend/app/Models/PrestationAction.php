<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Action d'une prestation (ex. « 3 vidéos Facebook / semaine »). */
class PrestationAction extends Model
{
    use HasUuids, SoftDeletes;

    public const TYPES = ['community_management', 'advertising', 'content_production', 'coaching', 'strategy', 'other'];

    public const FREQUENCIES = ['per_day', 'per_week', 'per_month', 'once'];

    public const STATUS_TODO = 'todo';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_DONE = 'done';

    public const STATUS_VALIDATED = 'validated';

    public const STATUS_BLOCKED = 'blocked';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_TODO,
        self::STATUS_IN_PROGRESS,
        self::STATUS_DONE,
        self::STATUS_VALIDATED,
        self::STATUS_BLOCKED,
        self::STATUS_CANCELLED,
    ];

    /** Statuts « terminés » : une action dans ces statuts n'est plus en retard. */
    public const FINISHED_STATUSES = [self::STATUS_DONE, self::STATUS_VALIDATED, self::STATUS_CANCELLED];

    protected $fillable = [
        'prestation_id',
        'package_item_id',
        'type',
        'title',
        'description',
        'platform',
        'quantity',
        'frequency',
        'unit',
        'budget',
        'actual_cost',
        'is_pass_through',
        'assigned_to',
        'start_date',
        'due_date',
        'status',
        'comment',
        'rating',
        'sort_order',
        'overdue_notified_at',
    ];

    protected $appends = ['quantity_done', 'is_overdue'];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'budget' => 'decimal:2',
            'actual_cost' => 'decimal:2',
            'is_pass_through' => 'boolean',
            'start_date' => 'date',
            'due_date' => 'date',
            'rating' => 'integer',
            'sort_order' => 'integer',
            'overdue_notified_at' => 'datetime',
        ];
    }

    public function prestation(): BelongsTo
    {
        return $this->belongsTo(Prestation::class);
    }

    public function packageItem(): BelongsTo
    {
        return $this->belongsTo(PackageItem::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PrestationActionComment::class)->latest();
    }

    public function logs(): HasMany
    {
        return $this->hasMany(PrestationActionLog::class)->latest('done_at');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(PrestationActionReview::class);
    }

    public function executions(): HasMany
    {
        return $this->hasMany(PrestationActionExecution::class)
            ->orderBy('week_number')
            ->orderBy('occurrence_number');
    }

    public function getQuantityDoneAttribute(): int
    {
        return (int) $this->logs()->sum('quantity_done');
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->due_date !== null
            && $this->due_date->lt(today())
            && ! in_array($this->status, self::FINISHED_STATUSES, true);
    }
}
