<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TreasuryAccount extends Model
{
    use HasUuids, SoftDeletes;

    public const TYPE_CASH = 'cash';
    public const TYPE_MOBILE_MONEY = 'mobile_money';
    public const TYPE_BANK = 'bank';

    public const TYPES = [
        self::TYPE_CASH,
        self::TYPE_MOBILE_MONEY,
        self::TYPE_BANK,
    ];

    protected $fillable = [
        'agency_id',
        'name',
        'type',
        'provider',
        'account_number',
        'opening_balance',
        'currency_code',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(TreasuryTransaction::class, 'treasury_account_id');
    }

    /**
     * Calculé : opening_balance + SUM(in) - SUM(out).
     * Le solde n'est jamais stocké.
     */
    public function getComputedBalanceAttribute(): float
    {
        $in = $this->transactions()->where('direction', 'in')->sum('amount');
        $out = $this->transactions()->where('direction', 'out')->sum('amount');

        return (float) $this->opening_balance + (float) $in - (float) $out;
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public static function typeValidationRule(): string
    {
        return 'required|string|in:' . implode(',', self::TYPES);
    }
}
