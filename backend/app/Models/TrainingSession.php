<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrainingSession extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'course_id',
        'module_id',
        'trainer_id',
        'agency_id',
        'start_at',
        'end_at',
        'max_capacity',
        'price',
        'status',
    ];

    /**
     * Valeur par défaut appliquée aussi en mémoire (sinon la réponse API
     * renvoie null avant que le défaut SQL « planned » ne soit lu).
     */
    protected $attributes = [
        'status' => 'planned',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'max_capacity' => 'integer',
            'price' => 'decimal:2',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CourseModule::class, 'module_id');
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class, 'trainer_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /**
     * Les assignations explicites d'apprenants à cette session spécifique.
     */
    public function participants(): HasMany
    {
        return $this->hasMany(SessionParticipant::class, 'training_session_id');
    }

    /**
     * Les inscriptions à la formation (cours) à laquelle appartient la session.
     */
    public function formationEnrollments(): HasMany
    {
        return $this->hasMany(FormationEnrollment::class, 'course_id', 'course_id');
    }

    /**
     * Prix effectif de la session (tarif propre sinon tarif du cours).
     */
    public function getEffectivePriceAttribute(): float
    {
        return $this->price !== null
            ? (float) $this->price
            : (float) ($this->course?->effective_price ?? $this->course?->price ?? 0);
    }

    public function isFull(): bool
    {
        return $this->max_capacity !== null
            && $this->participants()->where('status', 'enrolled')->count() >= $this->max_capacity;
    }
}