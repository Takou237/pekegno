<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TreasuryTransaction extends Model
{
    use HasUuids, SoftDeletes;

    public const DIRECTION_IN = 'in';
    public const DIRECTION_OUT = 'out';

    public const DIRECTIONS = [
        self::DIRECTION_IN,
        self::DIRECTION_OUT,
    ];

    protected $fillable = [
        'treasury_account_id',
        'direction',
        'amount',
        'source_type',
        'source_id',
        'category',
        'label',
        'reference',
        'transacted_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'transacted_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(TreasuryAccount::class, 'treasury_account_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function source()
    {
        return $this->morphTo();
    }

    public function scopeOfAccount($query, string $accountId)
    {
        return $query->where('treasury_account_id', $accountId);
    }

    public function scopeDirection($query, string $direction)
    {
        return $query->where('direction', $direction);
    }

    public function scopeBetweenDates($query, string $from, string $to)
    {
        return $query->whereBetween('transacted_at', [$from, $to]);
    }

    public static function directionValidationRule(): string
    {
        return 'required|string|in:' . implode(',', self::DIRECTIONS);
    }
}
