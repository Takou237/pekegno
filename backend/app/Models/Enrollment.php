<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Enrollment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'session_id',
        'learner_user_id',
        'status',
        'attendance',
        'attended_at',
        'notes',
        'invoice_id',
    ];

    protected function casts(): array
    {
        return [
            'attendance' => 'boolean',
            'attended_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TrainingSession::class, 'session_id');
    }

    public function learner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'learner_user_id');
    }
}