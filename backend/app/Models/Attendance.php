<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory, HasUuids;

    public const STATUS_PRESENT = 'present';
    public const STATUS_ABSENT = 'absent';

    public const STATUSES = [
        self::STATUS_PRESENT,
        self::STATUS_ABSENT,
    ];

    protected $fillable = [
        'training_session_id',
        'learner_user_id',
        'course_module_id',
        'status',
        'recorded_by',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
        ];
    }

    public function trainingSession(): BelongsTo
    {
        return $this->belongsTo(TrainingSession::class);
    }

    public function courseModule(): BelongsTo
    {
        return $this->belongsTo(CourseModule::class, 'course_module_id');
    }

    public function learner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'learner_user_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function scopeOfSession(Builder $query, string $sessionId): Builder
    {
        return $query->where('training_session_id', $sessionId);
    }

    public function scopeOfStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }
}
