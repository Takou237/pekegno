<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Équipier Agency (annuaire, calque du modèle employé) : exécute les actions
 * des prestations. Existe avec ou sans compte lié (user_id nullable) et porte
 * ses propres commissions (commission_type/value).
 */
class TeamMember extends Model
{
    use HasUuids, SoftDeletes;

    public const COMMISSION_TYPES = ['none', 'percent', 'fixed'];

    protected $fillable = [
        'agency_id',
        'department_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'user_id',
        'commission_type',
        'commission_value',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'commission_value' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function affectations(): HasMany
    {
        return $this->hasMany(PrestationTeamMember::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''));
    }

    /** Montant de commission sur une base (même formule que le commercial). */
    public function commissionFor(float $base, float $paidShare = 1.0): float
    {
        if ($this->commission_type === 'percent' && $this->commission_value !== null) {
            return round($base * (float) $this->commission_value / 100, 2);
        }

        if ($this->commission_type === 'fixed' && $this->commission_value !== null) {
            return round((float) $this->commission_value * $paidShare, 2);
        }

        return 0.0;
    }
}
