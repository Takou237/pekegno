<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Commercial extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'user_id',
        'agency_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'commission_type',
        'commission_value',
        'points_balance',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'commission_value' => 'decimal:2',
            'points_balance' => 'integer',
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

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function points(): HasMany
    {
        return $this->hasMany(CommercialPoint::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    /**
     * Commission figée (snapshot) au moment d'une vente.
     */
    public function commissionFor(float|int $total): float
    {
        if ($this->commission_type === 'none') {
            return 0.0;
        }

        return $this->commission_type === 'percent'
            ? round(((float) $this->commission_value / 100) * $total, 2)
            : (float) $this->commission_value;
    }
}
