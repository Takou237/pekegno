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

    public const STATUS_PLANNED = 'planned';
    public const STATUS_ONGOING = 'ongoing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'course_id',
        'module_id',
        'trainer_id',
        'agency_id',
        'start_at',
        'end_at',
        'max_capacity',
        'price',
        'duration_type',
        'status',
    ];

    /**
     * Valeur par défaut appliquée aussi en mémoire (sinon la réponse API
     * renvoie null avant que le défaut SQL « planned » ne soit lu).
     */
    protected $attributes = [
        'status' => 'planned',
        'duration_type' => 'unlimited',
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

    /**
     * B20 : le statut est calculé depuis les dates. Un statut terminal saisi
     * explicitement (annulée, terminée) est conservé ; sinon la session est
     * planifiée avant son début, en cours pendant, terminée après.
     */
    public function getStatusAttribute(?string $value): string
    {
        if (in_array($value, [self::STATUS_CANCELLED, self::STATUS_COMPLETED], true)) {
            return $value;
        }

        if ($this->start_at && now()->lt($this->start_at)) {
            return self::STATUS_PLANNED;
        }

        if ($this->end_at && now()->gt($this->end_at)) {
            return self::STATUS_COMPLETED;
        }

        if ($this->start_at && now()->gte($this->start_at)) {
            return self::STATUS_ONGOING;
        }

        return $value ?: self::STATUS_PLANNED;
    }

    protected static function booted(): void
    {
        // Dates repoussées après une clôture automatique : la session redevient
        // planifiée / en cours (le statut affiché se recalcule depuis les dates).
        static::saving(function (self $session) {
            if ($session->isDirty(['start_at', 'end_at'])
                && $session->getRawOriginal('status') === self::STATUS_COMPLETED
                && ($session->end_at === null || now()->lte($session->end_at))
                && ! $session->isDirty('status')) {
                $session->attributes['status'] = self::STATUS_PLANNED;
            }
        });
    }

    /**
     * Filtre SQL cohérent avec getStatusAttribute (le statut affiché se
     * calcule depuis les dates ; la colonne peut être en retard d'un jour).
     */
    public function scopeWithEffectiveStatus($query, string $status)
    {
        $now = now();
        $terminal = [self::STATUS_CANCELLED, self::STATUS_COMPLETED];

        return match ($status) {
            self::STATUS_CANCELLED => $query->where('status', self::STATUS_CANCELLED),
            self::STATUS_COMPLETED => $query->where(fn ($q) => $q->where('status', self::STATUS_COMPLETED)
                ->orWhere(fn ($qq) => $qq->where('status', '!=', self::STATUS_CANCELLED)->whereNotNull('end_at')->where('end_at', '<', $now))),
            self::STATUS_PLANNED => $query->whereNotIn('status', $terminal)
                ->where(fn ($q) => $q->where('start_at', '>', $now)->orWhere(fn ($qq) => $qq->whereNull('start_at')->where('status', self::STATUS_PLANNED))),
            self::STATUS_ONGOING => $query->whereNotIn('status', $terminal)
                ->where('start_at', '<=', $now)
                ->where(fn ($q) => $q->whereNull('end_at')->orWhere('end_at', '>=', $now)),
            default => $query->where('status', $status),
        };
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