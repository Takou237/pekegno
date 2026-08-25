<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Activity extends Model
{
    use HasUuids;

    public const TYPES = ['call', 'meeting', 'email', 'whatsapp', 'note', 'followup'];

    protected $fillable = [
        'subject_type',
        'subject_id',
        'assigned_to',
        'created_by',
        'type',
        'title',
        'notes',
        'due_at',
        'completed_at',
        'outcome',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeOverdue($query)
    {
        return $query->where('due_at', '<', now())
            ->whereNull('completed_at');
    }

    public function scopeUpcoming($query, int $days = 7)
    {
        return $query->where('due_at', '>=', now())
            ->where('due_at', '<=', now()->addDays($days))
            ->whereNull('completed_at');
    }

    public function scopeForSubject($query, string $type, string $id)
    {
        return $query->where('subject_type', $type)->where('subject_id', $id);
    }

    public function complete(string $outcome = null): void
    {
        $this->update([
            'completed_at' => now(),
            'outcome' => $outcome,
        ]);
    }

    public function getIsCompletedAttribute(): bool
    {
        return $this->completed_at !== null;
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->due_at !== null
            && $this->due_at->isPast()
            && $this->completed_at === null;
    }
}
