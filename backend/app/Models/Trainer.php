<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Profil formateur autonome : peut exister sans compte utilisateur
 * (user_id null) pour les intervenants qui n'utilisent pas la plateforme.
 */
class Trainer extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'agency_id',
        'user_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'bio',
        'points_balance',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'points_balance' => 'integer',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** Compte utilisateur optionnel : null si le formateur n'accède pas à la plateforme. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TrainingSession::class);
    }

    public function points(): HasMany
    {
        return $this->hasMany(TrainerPoint::class);
    }

    public function displayName(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''))
            ?: ($this->email ?? '');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(CourseModule::class);
    }

    /** Profil formateur du compte connecté (null : pas formateur). */
    public static function forUser(?User $user): ?self
    {
        return $user ? static::where('user_id', $user->id)->first() : null;
    }

    /** Modules de la formation confiés à ce formateur. */
    /** Modules qui lui sont confiés dans CETTE session. */
    public function moduleIdsForSession(TrainingSession $session): array
    {
        return SessionModuleTrainer::where('trainer_id', $this->id)
            ->where('training_session_id', $session->id)
            ->pluck('course_module_id')
            ->all();
    }

    /** Formateur principal de la session (il voit toute la session). */
    public function isMainTrainerOf(TrainingSession $session): bool
    {
        return $session->trainer_id !== null && $session->trainer_id === $this->id;
    }

    /**
     * Sessions accessibles : celles qu'il anime, et celles où un module lui
     * est confié (il n'y voit que son module). Le rattachement se fait par
     * session : il n'apparaît pas dans les autres sessions de la formation.
     *
     * @return array<int, string>
     */
    public function accessibleSessionIds(): array
    {
        return TrainingSession::query()
            ->where(fn ($q) => $q->where('trainer_id', $this->id)
                ->orWhereIn('id', SessionModuleTrainer::where('trainer_id', $this->id)->select('training_session_id')))
            ->pluck('id')
            ->all();
    }
}
