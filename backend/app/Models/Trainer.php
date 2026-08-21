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
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
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

    public function displayName(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''))
            ?: ($this->email ?? '');
    }
}
