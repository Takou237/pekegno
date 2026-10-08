<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Occurrence / exécution concrète d'une action récurrente de prestation. */
class PrestationActionExecution extends Model
{
    use HasUuids;

    public const STATUS_TODO = 'todo';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_DONE = 'done';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_TODO,
        self::STATUS_IN_PROGRESS,
        self::STATUS_DONE,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'prestation_action_id',
        'week_number',
        'week_start_date',
        'week_end_date',
        'occurrence_number',
        'title',
        'status',
        'scheduled_date',
        'done_at',
        'proof_url',
        'actual_cost',
        'note',
        'is_manual',
        'user_id',
        'assigned_to',
    ];

    protected $appends = ['is_overdue'];

    protected function casts(): array
    {
        return [
            'week_number' => 'integer',
            'occurrence_number' => 'integer',
            'week_start_date' => 'date',
            'week_end_date' => 'date',
            'scheduled_date' => 'date',
            'done_at' => 'datetime',
            'actual_cost' => 'decimal:2',
            'is_manual' => 'boolean',
        ];
    }

    public function action(): BelongsTo
    {
        return $this->belongsTo(PrestationAction::class, 'prestation_action_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function getIsOverdueAttribute(): bool
    {
        if ($this->status === self::STATUS_DONE || $this->status === self::STATUS_CANCELLED) {
            return false;
        }

        $checkDate = $this->scheduled_date ?? $this->week_end_date;

        return $checkDate !== null && Carbon::parse($checkDate)->endOfDay()->isPast();
    }
}

