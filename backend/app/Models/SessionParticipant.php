<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionParticipant extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'session_participants';

    protected $fillable = [
        'training_session_id',
        'formation_enrollment_id',
        'status',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(TrainingSession::class, 'training_session_id');
    }

    public function formationEnrollment(): BelongsTo
    {
        return $this->belongsTo(FormationEnrollment::class, 'formation_enrollment_id');
    }
}
